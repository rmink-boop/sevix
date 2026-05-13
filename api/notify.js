export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, title, type } = req.body;
  if (!email || !title) return res.status(400).json({ error: "Mangler e-post eller tittel" });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "E-posttjeneste ikke konfigurert" });

  try {
    // Send bekreftelse til brukeren
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "SEVIX <varsler@sevix.no>",
        to: email,
        subject: `Vi holder øye med "${title}" for deg 👀`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#0d0914;color:#fff;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1a0a2e,#0d0914);padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08)">
              <div style="font-size:11px;letter-spacing:6px;color:rgba(255,255,255,0.3);margin-bottom:8px;text-transform:uppercase">streaming guide</div>
              <div style="font-size:36px;font-weight:700;letter-spacing:4px;background:linear-gradient(135deg,#fff 30%,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">SEVIX</div>
            </div>
            <div style="padding:32px;">
              <h2 style="font-size:20px;font-weight:500;margin:0 0 12px;color:#fff">Vi passer på for deg! 🎬</h2>
              <p style="color:rgba(255,255,255,0.6);line-height:1.6;margin:0 0 20px;">
                Vi har registrert at du vil vite når <strong style="color:#a78bfa">${title}</strong> blir tilgjengelig på norske strømmetjenester.
              </p>
              <div style="background:rgba(139,92,246,0.15);border:0.5px solid rgba(139,92,246,0.4);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:4px">Du varsles om</div>
                <div style="font-size:16px;font-weight:500;color:#fff">${title}</div>
                <div style="font-size:12px;color:#a78bfa;margin-top:4px">${type === 'show' ? 'Serie' : 'Film'}</div>
              </div>
              <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;margin:0;">
                Så snart ${title} dukker opp på Netflix, Viaplay, TV 2 Play eller andre norske tjenester, sender vi deg en e-post.
              </p>
            </div>
            <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">
                Du mottar denne e-posten fordi du registrerte deg på <a href="https://sevix.no" style="color:#a78bfa;text-decoration:none">sevix.no</a><br/>
                Ikke deg? Ignorer denne e-posten.
              </p>
            </div>
          </div>
        `,
      }),
    });

    // Send intern kopi til deg selv
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "SEVIX Varsler <varsler@sevix.no>",
        to: "rmink@online.no",
        subject: `Ny varslingsregistrering: ${title}`,
        html: `
          <p><strong>Ny bruker vil varsles om:</strong></p>
          <p>Tittel: <strong>${title}</strong> (${type === 'show' ? 'Serie' : 'Film'})</p>
          <p>E-post: <strong>${email}</strong></p>
          <p>Tidspunkt: ${new Date().toLocaleString('no-NO')}</p>
        `,
      }),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Feil: ${err.message}` });
  }
}
