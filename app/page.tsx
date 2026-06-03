import Image from "next/image";
import Link from "next/link";
import { Drill, Mail, MapPin, Mountain, Phone, ShieldCheck } from "lucide-react";

const highlights = [
  {
    title: "Perfuração para mineração",
    description: "Serviço especializado de perfuração em frentes de lavra e áreas operacionais.",
    icon: Drill
  },
  {
    title: "Atuação em campo",
    description: "Equipe preparada para atuar em ambientes de mina e rotinas de operação mineral.",
    icon: ShieldCheck
  },
  {
    title: "Apoio à produção mineral",
    description: "Perfuração voltada ao avanço das atividades em áreas de extração mineral.",
    icon: Mountain
  }
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <Image src="/logo-dorighetto.jpeg" alt="Dorighetto Perfuração" width={64} height={64} priority />
          <div>
            <strong>Dorighetto</strong>
            <span>Perfuração</span>
          </div>
        </Link>

        <nav>
          <a href="#servico">Serviço</a>
          <a href="#atuacao">Atuação</a>
          <Link className="landing-login" href="/login">Login</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="landing-kicker">Perfuração para mineração</span>
          <h1>Serviços de perfuração para operações minerais.</h1>
          <p>
            A Dorighetto Perfuração atua em campo com serviços de perfuração para mineração,
            atendendo operações que precisam de precisão, disponibilidade e compromisso na execução.
          </p>
          <div className="landing-actions">
            <a className="landing-secondary" href="#atuacao">Conhecer atuação</a>
            <a className="landing-secondary" href="#contato">Falar com a empresa</a>
          </div>
        </div>

        <div className="hero-visual" aria-label="Imagem ilustrativa de perfuratriz em operação">
          <div className="hero-sky" />
          <Image src="/drill-rig-illustration.svg" alt="Perfuratriz ilustrativa" width={560} height={420} priority />
          <div className="hero-card hero-card-top">
            <strong>Serviço em campo</strong>
            <span>perfuração mineral</span>
          </div>
          <div className="hero-card hero-card-bottom">
            <strong>Mina Celeste</strong>
            <span>Curionópolis, PA</span>
          </div>
        </div>
      </section>

      <section className="landing-strip">
        <div><strong>Perfuração</strong><span>serviço especializado para mineração</span></div>
        <div><strong>Campo</strong><span>atuação em áreas operacionais</span></div>
        <div><strong>Mineração</strong><span>apoio à produção mineral</span></div>
      </section>

      <section className="landing-section" id="servico">
        <div className="landing-section-head">
          <span className="landing-kicker">Serviço</span>
          <h2>Atuação focada em perfuração para o setor mineral.</h2>
        </div>

        <div className="service-grid">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <article className="service-card" key={item.title}>
                <Icon size={28} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section area-section" id="atuacao">
        <div>
          <span className="landing-kicker">Área de atuação</span>
          <h2>Atendimento em frentes de mineração no Pará.</h2>
          <p>
            Uma das áreas de prestação de serviço informadas é a Mina Celeste, localizada em Curionópolis.
            Os textos desta página estão genéricos e podem ser substituídos depois pelas informações oficiais da empresa.
          </p>
        </div>

        <div className="area-card">
          <MapPin size={30} />
          <span>Operação de referência</span>
          <strong>Mina Celeste</strong>
          <p>Curionópolis, Pará</p>
        </div>
      </section>

      <section className="landing-cta" id="contato">
        <div className="contact-icon"><Phone size={28} /></div>
        <div>
          <span className="landing-kicker">Contato</span>
          <h2>Fale com a Dorighetto Perfuração</h2>
          <p>Dados genéricos para contato institucional. Depois podemos substituir pelas informações oficiais da empresa.</p>
        </div>
        <div className="contact-list">
          <a href="tel:+5594000000000"><Phone size={18} /> (94) 00000-0000</a>
          <a href="mailto:contato@dorighetto.com.br"><Mail size={18} /> contato@dorighetto.com.br</a>
          <span><MapPin size={18} /> Curionópolis, Pará</span>
        </div>
      </section>
    </main>
  );
}
