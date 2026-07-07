import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { asLocale, LOCALE_COOKIE } from "./locale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = asLocale(store.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
