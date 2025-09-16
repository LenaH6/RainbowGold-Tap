// Sobrescribimos WLD.login para que use SIWE
window.WLD = {
  login: () => {
    if (typeof loginSiwe === "function") {
      loginSiwe().catch(err => alert("Error SIWE: " + (err?.message || err)));
    } else {
      console.warn("loginSiwe no está disponible todavía.");
    }
  }
};
