import OpenAI from "openai";
import formidable from "formidable";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();
  form.uploadDir = "/tmp";
  form.keepExtensions = true;

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send("Error al subir el archivo");

    try {
      const uploadedFile = files.file;
      const buffer = await fs.readFile(uploadedFile.filepath);
      const data = await pdfParse(buffer);

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Eres un abogado experto en redacción de contratos. Analiza el siguiente contrato y entrega un informe con observaciones, errores, ambigüedades y sugerencias de mejora:\n\n${data.text.slice(0, 8000)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      });

      res.status(200).send(completion.choices[0].message.content);
    } catch (error) {
      console.error("Error en el análisis:", error);
      res.status(500).send("Error al analizar el documento");
    }
  });
}
