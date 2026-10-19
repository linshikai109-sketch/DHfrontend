import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { JohnNavigationLinks } from '../src/components/JohnNavigationLinks';

function navigation(path: string, icons = false) {
  const router = createMemoryRouter([
    { path: '*', element: createElement('nav', null, createElement(JohnNavigationLinks, { icons })) },
  ], { initialEntries: [path] });
  const markup = () => renderToStaticMarkup(createElement(RouterProvider, { router }));
  const active = () => {
    return [...markup().matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)]
      .filter(([, attributes]) => attributes.includes('aria-current="page"'))
      .map(([, attributes]) => attributes.match(/href="([^"]+)"/)![1]);
  };
  const destinations = () => [...markup().matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
  return { router, active, destinations };
}

describe('John navigation location', () => {
  it.each([false, true])('does not mark workspace links current during acquisition (icons=%s)', (icons) => {
    const { router, active } = navigation('/john/onboarding?canvas=full', icons);
    expect(active()).toEqual([]);
    router.dispose();
  });

  it.each(['/john/workbench', '/john/report', '/john/quest', '/john/profile'])('marks exactly the actual page current at %s', (path) => {
    const { router, active } = navigation(`${path}?fixture=upwork-v1`);
    expect(active()).toEqual([path]);
    router.dispose();
  });

  it('uses end matching so another page cannot inherit a parent link highlight', () => {
    const { router, active } = navigation('/john/profile/other');
    expect(active()).toEqual([]);
    router.dispose();
  });

  it('keeps current state in sync with history and report-close navigation', async () => {
    const { router, active } = navigation('/john/onboarding');
    await router.navigate('/john/workbench');
    expect(active()).toEqual(['/john/workbench']);
    await router.navigate('/john/report');
    expect(active()).toEqual(['/john/report']);
    await router.navigate(-1);
    expect(active()).toEqual(['/john/workbench']);
    await router.navigate(1);
    expect(active()).toEqual(['/john/report']);
    // The report's Close action returns to the workspace; location owns state.
    await router.navigate('/john/workbench');
    expect(active()).toEqual(['/john/workbench']);
    await router.navigate('/john/onboarding?canvas=full');
    expect(active()).toEqual([]);
    router.dispose();
  });

  it('gives desktop and mobile identical destinations and active semantics', () => {
    for (const path of ['/john/onboarding', '/john/workbench', '/john/report']) {
      const desktop = navigation(path, true);
      const mobile = navigation(path);
      expect(desktop.active()).toEqual(mobile.active());
      expect(desktop.destinations()).toEqual(['/john/workbench', '/john/report', '/john/quest', '/john/profile']);
      expect(mobile.destinations()).toEqual(desktop.destinations());
      desktop.router.dispose();
      mobile.router.dispose();
    }
  });
});
