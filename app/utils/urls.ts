function getCookie(name: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined; // or handle the server-side scenario
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    let cookieValue = parts.pop()?.split(";").shift();
    // Remove any surrounding quotes and trim whitespace
    cookieValue = cookieValue?.replace(/^"|"$/g, "").trim();
    // Return undefined if the value is empty
    return cookieValue && cookieValue !== "" ? cookieValue : undefined;
  }
  return undefined; // Return undefined if the cookie is not found
}

export const webappUrl = (path: string): string => {
  const env = getCookie("environment"); // Use the 'environment' cookie
  const baseDomain = env
    ? `https://app.${env}.chatopensource.com`
    : "https://app.localtest.local:3000"; // Fallback URL if the cookie isn't set or is empty
  return `${baseDomain}${path}`;
};

export const apiUrl = (path: string): string => {
  const env = getCookie("environment"); // Use the 'environment' cookie
  const authDomain = env
    ? `https://api.${env}.chatopensource.com`
    : "https://app.localtest.local:3000"; // Fallback URL if the cookie isn't set or is empty
  return `${authDomain}${path}`;
};
