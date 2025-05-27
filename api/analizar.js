import formidable from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';
import { Configuration, OpenAIApi } from 'openai';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Error al procesar el archivo:", err);
      return res.status(500).send("Error al subir el archivo");
    }

    try {
      const pdfPath = files.file.filepath;
      const buffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(buffer);

      const openai = new OpenAIApi(new Configuration({
        apiKey: process.env.OPENAI_API_KEY
      }));

      const prompt = `Revisa el siguiente contrato y genera un informe con observaciones, errores, riesgos o sugerencias de mejora:\n\n${data.text.slice(0, 8000)}`;

      const completion = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }]
      });

      const resultado = completion.data.choices[0].message.content;
      res.send(resultado);
    } catch (error) {
      console.error("❌ Error en el análisis:", error);
      res.status(500).send("Error durante el análisis del PDF");
    }
  });
}
