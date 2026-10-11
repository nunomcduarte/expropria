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
        options: { data: { nome_publico: nome.trim() }, emailRedirectTo: window.location.origin },
      });
      if (error) setErro(error.message);
      else if (data.session) onFechar();
      else setAviso("Conta criada. Confirma o registo no link que enviámos para o teu email.");
    }
    setAEnviar(false);
  }

  async function comGoogle() {
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErro("Não foi possível entrar com o Google.");
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
            <button type="button" className="google" onClick={comGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
                <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
              </svg>
              Entrar com Google
            </button>
            <p className="ou">ou com email</p>
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
