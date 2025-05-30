import OpenAI from "openai";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export const config = {
  api: {
    bodyParser: false, // 👈 Necesario para manejar archivos binarios
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Método no permitido");
  }

  try {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const buffer = Buffer.concat(buffers);

    const contentType = req.headers["content-type"] || "";
    const fileName = req.headers["x-file-name"] || "document";

    let text = "";

    if (contentType.includes("application/pdf") || fileName.endsWith(".pdf")) {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") || fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return res.status(400).send("Formato de archivo no soportado. Solo .pdf y .docx.");
    }

    console.log("📃 Texto extraído. Longitud:", text.length);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Eres un abogado experto en redacción de contratos para agencias de viajes de estudiantes. Analiza el siguiente contrato y entrega un informe claro con observaciones, errores, ambigüedades y recomendaciones de mejora:\n\n${text.slice(0, 8000)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const result = response.choices[0].message.content;
    console.log("✅ Análisis completado por OpenAI");
    res.status(200).send(result);

  } catch (error) {
    console.error("❌ Error interno:", error);
    res.status(500).send("Error al procesar el archivo");
  }
}
