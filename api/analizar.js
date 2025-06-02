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
      Eres un revisor especializado en contratos y documentos de viajes estudiantiles. Tu trabajo es entregar un informe directo, útil y concreto para que un vendedor pueda corregir rápidamente sin leer todo el documento.
      
      🟢 Comienza con un diagnóstico general:
      - ✅ OK si todo está correcto.
      - ⚠️ Si hay detalles menores a revisar.
      - ❗ Si hay errores importantes o incoherencias.
      
      El diagnóstico debe ser coherente con las observaciones: si hay errores, no indiques que está todo correcto.
      
      📝 Luego, entrega observaciones claras con este formato:
      - Qué parte revisar (título, anexo, tabla, nombre, etc.).
      - Qué texto está mal (cítalo si puedes).
      - Qué corrección concreta hacer.
      
      Ejemplo:
      - ⚠️ Revisar valor de la cuota: en el texto dice "$370.000", pero más abajo aparece "$390.000". Corregir para dejar un único valor.
      
      🎯 Evita frases genéricas como “revisar redacción”. Sé específico y sugiere qué cambiar.
      
      No repitas el texto completo del contrato. Sé claro, práctico y directo.
      
      Analiza el siguiente texto según las opciones marcadas por el usuario:\n\n`;



      if (opciones.includes("contrato")) {
        prompt += `
🔹 CONTRATO:
Revisa exclusivamente los elementos personalizables del contrato tipo (nombre de firmantes, valores, fechas, colegios, condiciones de pago, etc.). Detecta errores, omisiones o incoherencias respecto al modelo original. Ignora cláusulas fijas del contrato si no han sido modificadas.\n\n`;
      }

      if (opciones.includes("anexo1")) {
        prompt += `
🔹 ANEXO 1 (Itinerario y Programa):
Revisa lo siguiente de forma estricta y concreta:

1. Detecta si las actividades indicadas día por día (por ejemplo: "Floating", "Escape Room", "Discoteca", "Tambo Viejo", etc.) están **mencionadas también en la sección final del anexo ("El programa incluye")**. Enumera las actividades por día si puedes.

2. Marca con ⚠️ si hay alguna actividad que aparece en el itinerario diario y no aparece en la lista de “Incluye” o viceversa.

3. Revisa si hay **errores de coherencia** como:
   - Actividades repetidas o en días no posibles (ej: Floating el mismo día de salida).
   - Inconsistencias de horario (ej: actividades después del check-out).
   - Cuotas mal descritas o valores no coincidentes con lo indicado al final.

4. Da observaciones breves y claras. Usa este formato:
   - ⚠️ Actividad "Escape Room" aparece el Día 4 pero no está en la lista de “Incluye”. Agregar en la sección final.
   - ⚠️ En el Día 2 se menciona “Discoteca”, pero no hay traslado descrito. Confirmar.

5. Si puedes, sugiere la corrección concreta para cada observación.

No repitas el texto completo. Usa lenguaje claro, sin jerga técnica. Resume el itinerario por día si puedes para facilitar la revisión rápida por parte del vendedor.\n\n`;
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
        model: "gpt-4o",
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
