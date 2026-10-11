"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthModal({ onFechar }: { onFechar: () => void }) {
  const [modo, setModo] = useState<"entrar" | "registar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAEnviar(true);
    if (modo === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro("Email ou palavra-passe errados.");
      else onFechar();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome_publico: nome.trim() } },
      });
      if (error) setErro(error.message);
      else if (data.session) onFechar();
      else setAviso("Conta criada. Confirma o registo no link que enviámos para o teu email.");
    }
    setAEnviar(false);
  }

  return (
    <div className="fundo" onClick={onFechar}>
      <form className="caixa" onClick={(e) => e.stopPropagation()} onSubmit={submeter}>
        <header className="caixa-topo">
          <span>{modo === "entrar" ? "Cartão de militante" : "Novo cartão de militante"}</span>
          <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </header>
        <div className="caixa-corpo">
        <h2>{modo === "entrar" ? "Entrar" : "Registar"}</h2>
        {modo === "registar" && !aviso && <p className="sub">Só o teu nome público aparece no mapa. Pode ser um pseudónimo.</p>}
        {aviso ? (
          <p className="ok">{aviso}</p>
        ) : (
          <>
            {modo === "registar" && (
              <label>
                Nome público
                <input required minLength={2} maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
            )}
            <label>
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label>
              Palavra-passe
              <input
                type="password"
                required
                minLength={8}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              />
            </label>
            {erro && <p className="erro">{erro}</p>}
            <button className="primario" disabled={aEnviar}>
              {aEnviar ? "Um momento…" : modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
            <button type="button" className="ligacao" onClick={() => setModo(modo === "entrar" ? "registar" : "entrar")}>
              {modo === "entrar" ? "Ainda não tens conta? Regista-te" : "Já tens conta? Entra"}
            </button>
          </>
        )}
        </div>
      </form>
    </div>
  );
}
