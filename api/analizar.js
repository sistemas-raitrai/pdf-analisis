import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import mammoth from "mammoth";

export const config = {
  api: { bodyParser: false } // necesario para usar formidable en Vercel
};

export default async function handler(req, res) {
  console.log("📥 Iniciando análisis de archivo...");

  const form = formidable({
    keepExtensions: true,
    uploadDir: "/tmp",
    maxFileSize: 30 * 1024 * 1024
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al parsear el formulario:", err);
      return res.status(500).send("Error al procesar el formulario");
    }

    try {
      const fileObj = files.file?.[0] || Object.values(files)[0];
      const filePath = fileObj?.filepath;
      const mimeType = fileObj?.mimetype;
      const opciones = JSON.parse(fields.opciones?.[0] || "[]");

      if (!filePath || mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return res.status(400).send("Solo se aceptan archivos DOCX.");
      }

      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = result.value;
      console.log("📃 Texto extraído. Longitud:", extractedText.length);

      // Generación dinámica del prompt
      let prompt = `
      Eres un revisor experto en contratos de viajes estudiantiles. Tu tarea es entregar un informe claro, breve y útil para vendedores que no leen mucho texto.
      
      1. Comienza con un **Diagnóstico General** que resuma el estado del documento:
      - ✅ Todo correcto: solo si no hay observaciones importantes.
      - ⚠️ Requiere correcciones menores.
      - ❗Errores graves detectados que deben corregirse.
      
      ❗ IMPORTANTE: Este diagnóstico debe ser **coherente** con las observaciones. Si encuentras errores en los puntos siguientes, NO indiques que está "Todo correcto".
      
      2. Luego, entrega observaciones concretas como bullets. Cada punto debe indicar:
      - Qué parte revisar (ej: nombre del colegio, fechas, montos).
      - Qué error se detectó (cita el texto si es posible).
      - Qué debe corregirse exactamente (propón una corrección concreta).
      
      3. Usa este formato claro:
      - ⚠️ Revisar nombre del colegio: "Colegio ABC" aparece con error ("ABC" escrito como "ACB"). Corregir en el título del contrato.
      - ⚠️ La dirección "La Concepción 305" no coincide con anexo 1. Unificar ambas.
      
      4. No repitas el contrato ni uses lenguaje legal. Sé preciso, directo y práctico.
      
      Analiza el siguiente texto según las instrucciones seleccionadas por el usuario:\n\n`;


      if (opciones.includes("contrato")) {
        prompt += `
🔹 CONTRATO:
Revisa exclusivamente los elementos personalizables del contrato tipo (nombre de firmantes, valores, fechas, colegios, condiciones de pago, etc.). Detecta errores, omisiones o incoherencias respecto al modelo original. Ignora cláusulas fijas del contrato si no han sido modificadas.\n\n`;
      }

      if (opciones.includes("anexo1")) {
        prompt += `
🔹 ANEXO 1 (Itinerario y Programa):
Revisa el itinerario detallado día por día y compáralo con la sección final donde se enumeran los servicios que el programa "Incluye".

1. Asegúrate de que todas las actividades mencionadas día por día estén también reflejadas en la lista de "Incluye", y viceversa. Detecta si falta alguna actividad o si hay inconsistencias.
2. Si puedes, haz un pequeño resumen con bullets indicando las actividades por día (Día 1, Día 2, etc.) para facilitar la revisión por parte del usuario.
3. Verifica también si los valores, fechas y condiciones de cambio o cancelación son claras y coherentes.
4. Indica errores frecuentes como:
   - Actividades mencionadas pero no incluidas.
   - Incoherencias entre días (ej: check-out el Día 4 pero actividades Día 5).
   - Listas de "Incluye" mal redactadas, incompletas o contradictorias.
5. Sé claro, directo y útil para un usuario que solo quiere saber qué revisar y qué corregir.

Entrega un análisis claro y corto, sin repetir el texto completo del contrato.\n\n`;
      }

      if (opciones.includes("anexo2")) {
        prompt += `
🔹 ANEXO 2 (Seguro Médico):
Verifica que el seguro médico descrito en este anexo coincida con lo que se menciona en el contrato y que no haya contradicciones. Evalúa la claridad de cobertura, condiciones, exclusiones y vigencia.\n\n`;
      }

      if (opciones.includes("anexo3")) {
        prompt += `
🔹 ANEXO 3 (Seguro de Cancelación):
Haz una revisión básica de este anexo. Solo alerta si hay omisiones graves o incoherencias importantes. Este anexo suele mantenerse fijo.\n\n`;
      }

      // Adjunta el texto completo (o parte si es muy largo)
      prompt += `Texto del documento:\n\n${extractedText.slice(0, 8000)}`;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }]
      });

      const resultText = response.choices[0].message.content;
      console.log("✅ Análisis completado.");
      res.status(200).send(resultText);

    } catch (error) {
      console.error("❌ Error interno:", error);
      res.status(500).send("Error al procesar el archivo.");
    }
  });
}
