"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({ name, label, autoComplete, disabled }: { name: string; label: string; autoComplete: string; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  const id = `account-${name}`;
  return <div className="password-field"><label htmlFor={id}>{label}</label><div className="password-input"><input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={1} maxLength={256} required disabled={disabled}/><button type="button" className="password-toggle" disabled={disabled} aria-label={`${visible ? "Ocultar" : "Mostrar"}: ${label}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={20} aria-hidden="true"/> : <Eye size={20} aria-hidden="true"/>}</button></div></div>;
}
