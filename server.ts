import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of the Gemini client to prevent crashes if the key is missing at startup
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Please add it in Settings > Secrets.");
    }
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints go here FIRST
  app.post("/api/generate-retention", async (req, res) => {
    try {
      const { customer } = req.body;
      if (!customer) {
        return res.status(400).json({ error: "Customer profile is required." });
      }

      const client = getGeminiClient();

      const prompt = `
        Analise o perfil do seguinte cliente bancário que apresenta risco de churn (cancelamento de conta) e gere uma estratégia de retenção personalizada e de alta eficácia.

        Perfil do Cliente:
        - Nome/Sobrenome: ${customer.surname}
        - Idade: ${customer.age} anos
        - Pontuação de Crédito (Credit Score): ${customer.creditScore}
        - País: ${customer.geography}
        - Gênero: ${customer.gender === 'Female' ? 'Feminino' : 'Masculino'}
        - Saldo em Conta: €${customer.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        - Salário Estimado: €${customer.estimatedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        - Quantidade de Produtos do Banco: ${customer.numOfProducts}
        - Possui Cartão de Crédito? ${customer.hasCrCard ? 'Sim' : 'Não'}
        - É Membro Ativo? ${customer.isActiveMember ? 'Sim' : 'Não'}
        - Tempo de Casa (Tenure): ${customer.tenure} anos

        Instruções de Resposta:
        1. Identifique os 2 principais fatores de risco específicos deste cliente (ex: inatividade, excesso de produtos, país de alta volatilidade como Alemanha, saldo elevado vulnerável a concorrentes).
        2. Proponha uma oferta de retenção específica e acionável do banco (ex: isenção de tarifas, taxas especiais em investimentos para alto saldo, consolidação inteligente de produtos, atendimento exclusivo).
        3. Escreva um modelo de mensagem/e-mail curto, empático e persuasivo (em português) pronto para ser enviado ao cliente, oferecendo essa solução.

        Mantenha a resposta concisa, profissional e estruturada de forma limpa. Use formatação Markdown.
      `;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ 
        error: error.message || "Erro interno ao gerar a estratégia de retenção com o Gemini." 
      });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
