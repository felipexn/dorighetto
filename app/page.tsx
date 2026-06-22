import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, Drill, Mail, MapPin, Mountain, Phone, ShieldCheck, Sparkles } from "lucide-react";

const services = [
  {
    title: "Perfuração operacional",
    description: "Execução de furos com controle de produção, registro de metros perfurados e acompanhamento da frente de serviço.",
    icon: Drill
  },
  {
    title: "Equipamentos de ponta",
    description: "Operação com perfuratrizes preparadas para atender demandas de campo com força, precisão e regularidade.",
    icon: Sparkles
  },
  {
    title: "Atendimento em campo",
    description: "Equipe voltada para rotinas reais de obra, pedreira e mineração, com foco em segurança e continuidade operacional.",
    icon: ShieldCheck
  }
];

const areas = [
  "Mina Celeste, Curionópolis",
  "Brita Forte, Xinguara",
  "Sede em Parauapebas"
];

export default function LandingPage() {
  return (
    <main className="landing-page refined-landing">
      <header className="landing-nav refined-nav">
        <Link className="landing-brand refined-brand" href="/">
          <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={64} height={64} priority />
          <div>
            <strong>Dorighetto</strong>
            <span>Perfuração</span>
          </div>
        </Link>

        <nav>
          <a href="#servicos">Serviços</a>
          <a href="#atuacao">Atuação</a>
          <a href="#contato">Contato</a>
          <Link className="landing-login" href="/login">Login</Link>
        </nav>
      </header>

      <section className="landing-hero refined-hero">
        <div className="landing-copy refined-copy">
          <span className="landing-kicker">Perfuração com precisão em campo</span>
          <h1>Serviços de perfuração para operações que não podem parar.</h1>
          <p>
            A Dorighetto Perfuração atua com perfuratrizes de ponta, equipe preparada e foco em produtividade
            para mineração, pedreiras, frentes de lavra e serviços de campo que exigem execução confiável.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href="tel:+5594991395293"><Phone size={18} /> Falar agora</a>
            <a className="landing-secondary" href="#servicos">Conhecer serviços <ArrowUpRight size={18} /></a>
          </div>
        </div>

        <div className="hero-visual refined-visual" aria-label="Perfuratriz em operação de campo">
          <Image className="hero-photo" src="/perfuratriz-campo.png" alt="Perfuratriz de campo da Dorighetto" width={900} height={680} priority />
          <div className="hero-card hero-card-top refined-card">
            <strong>Equipamento em campo</strong>
            <span>perfuratrizes de ponta</span>
          </div>
          <div className="hero-card hero-card-bottom refined-card dark-card">
            <strong>Parauapebas, PA</strong>
            <span>sede operacional</span>
          </div>
        </div>
      </section>

      <section className="landing-strip refined-strip" aria-label="Resumo da empresa">
        <div><strong>Perfuração</strong><span>serviço especializado em campo</span></div>
        <div><strong>Produtividade</strong><span>controle de metros perfurados</span></div>
        <div><strong>Pará</strong><span>atuação regional com mobilidade</span></div>
      </section>

      <section className="landing-section refined-section" id="servicos">
        <div className="landing-section-head refined-section-head">
          <span className="landing-kicker">Serviços</span>
          <h2>Perfuração feita para obra, pedreira e mineração.</h2>
          <p>
            O trabalho é direto: posicionar equipamento, perfurar com qualidade e entregar uma operação mais previsível para quem depende do avanço do campo.
          </p>
        </div>

        <div className="service-grid refined-service-grid">
          {services.map((item) => {
            const Icon = item.icon;
            return (
              <article className="service-card refined-service-card" key={item.title}>
                <span className="service-icon"><Icon size={26} /></span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section refined-area" id="atuacao">
        <div className="area-copy">
          <span className="landing-kicker">Atuação</span>
          <h2>Presença em frentes importantes do sudeste do Pará.</h2>
          <p>
            A empresa presta serviços em operações como Mina Celeste, em Curionópolis, e Brita Forte, em Xinguara,
            mantendo base em Parauapebas para apoiar a rotina operacional.
          </p>
        </div>

        <div className="area-list">
          {areas.map((area, index) => (
            <article className="area-pill" key={area}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{area}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta refined-contact" id="contato">
        <div className="contact-icon"><Building2 size={30} /></div>
        <div>
          <span className="landing-kicker">Contato</span>
          <h2>Solicite atendimento da Dorighetto Perfuração.</h2>
          <p>Entre em contato para verificar disponibilidade de equipamento, frente de serviço e condições de atendimento.</p>
        </div>
        <div className="contact-list refined-contact-list">
          <a href="tel:+5594991395293"><Phone size={18} /> (94) 99139-5293</a>
          <a href="mailto:dorighettoperfuratriz@gmail.com"><Mail size={18} /> dorighettoperfuratriz@gmail.com</a>
          <span><MapPin size={18} /> Sede em Parauapebas, PA</span>
        </div>
      </section>
    </main>
  );
}
