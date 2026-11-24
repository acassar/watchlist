import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '@/App.vue';
import { i18n } from '@/plugins/i18n';
import { createAppRouter } from '@/router';
import { fakeUser, fetchByUrl } from '@/test/setup';
import DonateCard from './components/DonateCard.vue';
import { donationUrl } from './support';

const session = [200, { accessToken: 'jwt', user: fakeUser }] as const;

async function settle() {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
}

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Introuvable : ${selector}`);
  return found;
}

describe('lien de don', () => {
  it('pointe vers la page de don Liberapay', () => {
    expect(donationUrl('canapact')).toBe(
      'https://liberapay.com/canapact/donate',
    );
    expect(donationUrl(' a b ')).toBe('https://liberapay.com/a%20b/donate');
    expect(donationUrl('1935215')).toBe(
      'https://liberapay.com/~1935215/donate',
    );
  });

  it('n’existe pas sans identifiant', () => {
    expect(donationUrl('')).toBeNull();
    expect(donationUrl('   ')).toBeNull();
  });

  it('s’ouvre ailleurs, sans transmettre la page d’origine', () => {
    const wrapper = mount(DonateCard, {
      props: { username: 'canapact' },
      global: { plugins: [i18n, createVuetify()] },
    });
    const link = wrapper.get('[data-test="donate-link"]');
    expect(link.attributes('href')).toBe(
      'https://liberapay.com/canapact/donate',
    );
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(wrapper.text()).toContain('Offrir un plaid à Canapact');
  });

  it('reste caché tant qu’aucun compte n’est configuré', () => {
    const wrapper = mount(DonateCard, {
      props: { username: '' },
      global: { plugins: [i18n, createVuetify()] },
    });
    expect(wrapper.find('[data-test="donate-card"]').exists()).toBe(false);
  });
});

describe('page À propos', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('s’ouvre depuis le menu du compte', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/auth/refresh': [session],
        '/api/groups': [[200, []]],
      }),
    );
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createAppRouter(createMemoryHistory());
    await router.push('/alone');
    await router.isReady();
    mount(App, {
      global: { plugins: [pinia, router, i18n, createVuetify()] },
      attachTo: document.body,
    });
    await settle();
    el('[aria-label="Mon compte"]').click();
    await settle();
    el('[data-test="open-about"]').click();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('about'),
    );
    await settle();
    expect(document.body.textContent).toContain('Crédits');
  });

  it('se lit sans compte, depuis l’écran de connexion', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({ '/api/auth/refresh': [[401, { code: 'UNAUTHENTICATED' }]] }),
    );
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createAppRouter(createMemoryHistory());
    await router.push('/login');
    await router.isReady();
    mount(App, {
      global: { plugins: [pinia, router, i18n, createVuetify()] },
      attachTo: document.body,
    });
    await settle();
    el('[data-test="auth-about"]').click();
    await vi.waitFor(() =>
      expect(router.currentRoute.value.name).toBe('about'),
    );
    await settle();
    expect(document.body.textContent).toContain('Crédits');
  });
});
