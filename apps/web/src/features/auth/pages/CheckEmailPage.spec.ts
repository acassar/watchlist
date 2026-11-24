import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fetchByUrl } from '@/test/setup';

async function mountCheckEmail() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  // La page lit l'adresse dans history.state, que l'historique mémoire ne remplit pas.
  window.history.replaceState({ email: 'adrien@exemple.fr' }, '');
  await router.push({ name: 'check-email' });
  await router.isReady();
  const wrapper = mount(App, {
    global: { plugins: [pinia, router, i18n, createVuetify()] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

async function clickResend(
  wrapper: Awaited<ReturnType<typeof mountCheckEmail>>,
) {
  // Page chargée à la demande : on attend qu'elle soit affichée.
  const button = await vi.waitFor(() => {
    const found = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Renvoyer'));
    if (!found) throw new Error('bouton absent');
    return found;
  });
  await button.trigger('click');
  await flushPromises();
}

describe('CheckEmailPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('dit quand le quota d’emails du jour est épuisé', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]],
        '/api/auth/verify-email/resend': [
          [503, { code: 'MAIL_QUOTA_EXCEEDED', message: 'x' }],
        ],
      }),
    );
    const wrapper = await mountCheckEmail();

    await clickResend(wrapper);

    expect(document.body.textContent).toContain('Réessayez demain');
    expect(document.body.textContent).not.toContain("C'est reparti");
  });

  it('annonce le renvoi sinon', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]],
        '/api/auth/verify-email/resend': [[202, {}]],
      }),
    );
    const wrapper = await mountCheckEmail();

    await clickResend(wrapper);

    expect(document.body.textContent).toContain("C'est reparti");
    expect(document.body.textContent).not.toContain('Réessayez demain');
  });
});
