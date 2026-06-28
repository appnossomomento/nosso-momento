'use client';

import { useAppStore } from '@/lib/store/appStore';

export default function LegalModal() {
  const { showLegalModal, legalModalType, set } = useAppStore();
  if (!showLegalModal) return null;

  const isTerms = legalModalType === 'terms';
  const title = isTerms ? 'Termos de Uso' : 'Política de Privacidade';

  function close() {
    set({ showLegalModal: false, legalModalType: null });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={close}>
        <div
          className="w-full max-w-lg rounded-3xl bg-[#120b16] text-white shadow-2xl border border-white/10 p-6 flex flex-col"
          style={{ maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between shrink-0">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Consentimento</p>
              <h3 className="text-2xl font-semibold mt-1">{title}</h3>
            </div>
            <button onClick={close} className="text-white/70 hover:text-white transition">
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/80 leading-relaxed overflow-y-auto flex-1">
            {isTerms ? <TermsContent /> : <PrivacyContent />}
          </div>

          <div className="mt-4 shrink-0">
            <button
              onClick={close}
              className="w-full rounded-xl bg-white/10 py-3 text-white/80 font-semibold hover:bg-white/20 transition"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TermsContent() {
  return (
    <div>
      <p className="font-semibold text-white mb-2">Versão 1.0 — Vigente a partir de 19/05/2026</p>
      <p className="mb-3">Bem-vindo ao <strong>Nosso Momento</strong>. Ao se cadastrar e utilizar o aplicativo, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso, em conformidade com a Lei Federal nº 12.965/2014 (Marco Civil da Internet) e a Lei Federal nº 13.709/2018 (LGPD).</p>
      <Section title="1. Descrição do Serviço">O Nosso Momento é um aplicativo web destinado a casais, que oferece funcionalidades de check-in emocional diário, catálogo de momentos a dois, desafios semanais, conquistas, memórias compartilhadas e notificações push. O serviço é disponibilizado exclusivamente via internet, em dispositivos compatíveis.</Section>
      <Section title="2. Elegibilidade">O uso do aplicativo é permitido apenas a maiores de 18 anos. Ao se cadastrar, você declara ter capacidade civil plena para aceitar estes termos. Contas de menores de idade serão encerradas imediatamente ao serem identificadas.</Section>
      <Section title="3. Cadastro e Responsabilidades do Usuário">Você é responsável pela veracidade e atualização das informações fornecidas no cadastro (nome, e-mail, telefone, dados de perfil e personalização da loja). Seu login e senha são pessoais e intransferíveis. O compartilhamento de credenciais é proibido, e o Nosso Momento não se responsabiliza por acessos indevidos decorrentes de negligência do usuário. Você se compromete a não utilizar o aplicativo para fins ilícitos, discriminatórios ou que violem direitos de terceiros.</Section>
      <Section title="4. Propriedade Intelectual">Todo o conteúdo do aplicativo — incluindo textos, design, ícones, funcionalidades e código-fonte — é propriedade do Nosso Momento e está protegido por lei. É vedada a reprodução, distribuição ou modificação sem autorização expressa e por escrito.</Section>
      <Section title="5. Limitação de Responsabilidade">O Nosso Momento não se responsabiliza por danos decorrentes de: (a) falhas de conexão ou dispositivos do usuário; (b) uso indevido das credenciais de acesso; (c) conteúdo enviado por outros usuários; (d) indisponibilidade temporária dos serviços de terceiros (Google Firebase, Vercel). O serviço é fornecido &ldquo;no estado em que se encontra&rdquo;, sem garantias de funcionamento ininterrupto.</Section>
      <Section title="6. Cookies e Rastreamento">O Nosso Momento utiliza cookies e tecnologias similares para: (a) manter sua sessão autenticada; (b) analisar o uso do aplicativo via Google Analytics (GA4) e Meta Pixel (Facebook); (c) melhorar a experiência do usuário. Os dados coletados por essas ferramentas são pseudonimizados e utilizados de forma agregada para fins estatísticos e de marketing.</Section>
      <Section title="7. Encerramento de Conta">Você pode solicitar a exclusão completa da sua conta a qualquer momento, diretamente no aplicativo, em &ldquo;Meu Perfil → Excluir minha conta&rdquo;. Todos os seus dados serão removidos conforme descrito na Política de Privacidade.</Section>
      <Section title="8. Alterações nos Termos">O Nosso Momento reserva-se o direito de modificar estes Termos a qualquer momento. Alterações relevantes serão comunicadas por e-mail ou notificação no app. O uso continuado do serviço após a comunicação implica aceitação das novas condições.</Section>
      <Section title="9. Foro">Eventuais disputas serão regidas pelas leis brasileiras e processadas no foro da comarca de São Paulo/SP, com renúncia a qualquer outro, por mais privilegiado que seja.</Section>
      <p className="font-semibold text-white mt-4 mb-1">10. Contato</p>
      <p>Dúvidas e solicitações: <span className="text-pink-400">faleconosco@nossomomento.app</span></p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div>
      <p className="font-semibold text-white mb-2">Versão 1.0 — Vigente a partir de 19/05/2026</p>
      <p className="mb-3">Esta Política de Privacidade descreve como o <strong>Nosso Momento</strong> coleta, usa, armazena e protege seus dados pessoais, em conformidade com a Lei Federal nº 13.709/2018 (LGPD).</p>
      <Section title="1. Controlador dos Dados"><strong>Nosso Momento App</strong> — faleconosco@nossomomento.app</Section>
      <Section title="2. Dados Coletados e Finalidade">Coletamos os dados necessários ao serviço e, quando informados no cadastro, dados de perfil (idade, localização, gênero, orientação sexual, estado civil) para fins analíticos internos e melhoria do produto. Também coletamos e-mail, telefone, apelido no card (opcional), personalização da loja de momentos, foto de perfil (opcional), token FCM, dados de uso (check-ins, desafios, conquistas, memórias) e dados de dispositivo para segurança. Dados sensíveis de perfil não são exibidos publicamente a outros usuários, exceto o necessário para o funcionamento do catálogo entre parceiros pareados.</Section>
      <Section title="3. Base Legal">O tratamento dos seus dados é realizado com base no <strong>consentimento livre e informado</strong> (LGPD Art. 7º, I), manifestado no ato do cadastro.</Section>
      <Section title="4. Operadores (Terceiros)">Google Firebase (Firestore, Auth, Storage, Cloud Functions, FCM), Vercel Inc., Google Analytics (GA4) e Meta Platforms (Facebook Pixel). Seus dados <strong>não são vendidos</strong> a terceiros.</Section>
      <Section title="5. Cookies e Rastreamento">Utilizamos cookies para manter sua sessão autenticada, coletar métricas de uso via Google Analytics e medir eficácia de campanhas via Meta Pixel. Dados analíticos são pseudonimizados.</Section>
      <Section title="6. Retenção dos Dados">Seus dados são mantidos enquanto sua conta estiver ativa. Após exclusão, são removidos em até <strong>30 dias</strong>, exceto registros de acesso (6 meses, conforme Marco Civil Art. 15).</Section>
      <Section title="7. Segurança">Criptografia em trânsito (HTTPS/TLS), autenticação segura via Firebase Auth e regras de acesso ao banco de dados (Firestore Security Rules).</Section>
      <p className="font-semibold text-white mt-4 mb-1">8. Seus Direitos (LGPD Art. 18)</p>
      <ul className="list-disc pl-5 mb-3 space-y-1">
        <li><strong>Confirmação e acesso</strong> aos seus dados</li>
        <li><strong>Retificação</strong> de dados incompletos ou incorretos</li>
        <li><strong>Eliminação</strong> — disponível em &ldquo;Meu Perfil → Excluir minha conta&rdquo;</li>
        <li><strong>Portabilidade</strong> dos seus dados</li>
        <li><strong>Revogação do consentimento</strong> a qualquer momento</li>
      </ul>
      <p className="mb-3">Contato: <span className="text-pink-400">faleconosco@nossomomento.app</span>. Você também pode reclamar à <strong>ANPD</strong>.</p>
      <Section title="9. Transferência Internacional">Seus dados podem ser processados em servidores no EUA (Google, Vercel), que adotam salvaguardas conforme LGPD Art. 33.</Section>
      <Section title="10. Alterações">Esta Política pode ser atualizada. Alterações relevantes serão comunicadas com antecedência mínima de 15 dias.</Section>
      <p className="font-semibold text-white mt-4 mb-1">11. Contato e DPO</p>
      <p>Dúvidas: <span className="text-pink-400">faleconosco@nossomomento.app</span></p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="font-semibold text-white mt-4 mb-1">{title}</p>
      <p className="mb-3">{children}</p>
    </>
  );
}
