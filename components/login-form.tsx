"use client";

import { useActionState } from "react";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { loginAction } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form className="login-card" action={action}>
      <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={128} height={128} priority />
      <div>
        <span className="eyebrow">Acesso restrito</span>
        <h1>Dorighetto Perfuração</h1>
        <p>Entre para acessar as planilhas financeiras.</p>
      </div>

      <label>
        Email
        <input name="email" type="email" placeholder="admin@dorighetto.local" required />
      </label>

      <label>
        Senha
        <input name="password" type="password" placeholder="Sua senha" required />
      </label>

      {state?.error ? <div className="form-error">{state.error}</div> : null}

      <button type="submit" disabled={pending}>
        <LogIn size={18} /> {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}


