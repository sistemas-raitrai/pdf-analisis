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
      let prompt = "Eres un abogado experto en contratos de agencias de viajes estudiantiles. Analiza el siguiente texto de acuerdo a las instrucciones:\n\n";

      if (opciones.includes("contrato")) {
        prompt += `
🔹 CONTRATO:
Revisa exclusivamente los elementos personalizables del contrato tipo (nombre de firmantes, valores, fechas, colegios, condiciones de pago, etc.). Detecta errores, omisiones o incoherencias respecto al modelo original. Ignora cláusulas fijas del contrato si no han sido modificadas.\n\n`;
      }

      if (opciones.includes("anexo1")) {
        prompt += `
🔹 ANEXO 1 (Itinerario y Programa):
Revisa que el itinerario y programa sean coherentes, completos y específicos. Evalúa si los servicios incluidos y excluidos están bien detallados, si los valores son correctos y si la política de cambio o cancelación es clara. Señala errores frecuentes.\n\n`;
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
