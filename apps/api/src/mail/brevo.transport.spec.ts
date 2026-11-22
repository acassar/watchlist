import { BrevoMailTransport } from './brevo.transport.js';

describe('BrevoMailTransport', () => {
  const message = {
    to: { email: 'a@b.fr', name: 'A' },
    subject: 'Sujet',
    html: '<p>Salut</p>',
    text: 'Salut',
  };

  it("appelle l'API transactionnelle avec la clé et l'expéditeur", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 201 }));
    const transport = new BrevoMailTransport(
      'cle-api',
      { email: 'bonjour@canapact.fr', name: 'Canapact' },
      fetchFn,
    );

    await transport.send(message);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('cle-api');
    expect(JSON.parse(init.body as string)).toMatchObject({
      sender: { email: 'bonjour@canapact.fr', name: 'Canapact' },
      to: [{ email: 'a@b.fr', name: 'A' }],
      subject: 'Sujet',
    });
  });

  it('lève une erreur si Brevo refuse', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('{"code":"unauthorized"}', { status: 401 }),
      );
    const transport = new BrevoMailTransport(
      'mauvaise-cle',
      { email: 'x@y.fr', name: 'X' },
      fetchFn,
    );
    await expect(transport.send(message)).rejects.toThrow('401');
  });
});
