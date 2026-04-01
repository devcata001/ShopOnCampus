let cart = [];
if (localStorage.insidelautech_cart) {
  cart = JSON.parse(localStorage.getItem("insidelautech_cart"));
}

const PAYSTACK_PUBLIC_KEY =
  localStorage.getItem("insidelautech_paystack_test_key") ||
  "pk_test_f56cc9f27a927af6dadbc4653123594a385a3624";

const ensurePaystackScript = (() => {
  let loadingPromise = null;

  return () => {
    if (window.PaystackPop) {
      return Promise.resolve();
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-paystack-inline="true"]',
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Unable to load Paystack script.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.dataset.paystackInline = "true";
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Unable to load Paystack script."));
      document.head.appendChild(script);
    });

    return loadingPromise;
  };
})();

// Always move toast container to top of body
function ensureToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container-custom";
    document.body.appendChild(container);
  }
  // Move to top of body if not already
  if (container !== document.body.firstElementChild) {
    document.body.insertBefore(container, document.body.firstChild);
  }
  return container;
}

// Ensure toast CSS is loaded on every page
(function ensureToastCSS() {
  if (!document.getElementById("toastStyles")) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = "../css/styles.css";
    style.id = "toastStyles";
    document.head.appendChild(style);
  }
})();

const showToast = (message, type = "info") => {
  const container = ensureToastContainer();
  const toast = document.createElement("div");

  const typeClassMap = {
    success: "toast-success",
    error: "toast-error",
    warning: "toast-warning",
    info: "toast-info",
  };

  const toastTypeClass = typeClassMap[type] || typeClassMap.info;
  toast.className = `toast-custom ${toastTypeClass}`;
  toast.innerHTML = `
      <span class="toast-message">${message}</span>
        <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
    `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  const removeToast = () => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  };

  const closeButton = toast.querySelector(".toast-close");
  if (closeButton) {
    closeButton.addEventListener("click", removeToast);
  }

  setTimeout(removeToast, 3000);
};

const updateCartCount = () => {
  const cartCount = document.getElementById("cartCount");
  if (cartCount) {
    let total = 0;
    for (let i = 0; i < cart.length; i++) {
      total = total + cart[i].quantity;
    }
    cartCount.textContent = total;
  }
};

const addToCart = (product) => {
  const user = checkSession();
  if (!user) {
    showToast("Please login or sign up to add items to cart!", "warning");
    if (window.location.pathname.includes("/pages/")) {
      window.location.href = "login.html";
    } else {
      window.location.href = "pages/login.html";
    }
    return;
  }

  let found = false;
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id === product.id) {
      cart[i].quantity = cart[i].quantity + 1;
      found = true;
      break;
    }
  }

  if (!found) {
    const newItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      description: product.description,
      quantity: 1,
    };
    cart.push(newItem);
  }

  localStorage.setItem("insidelautech_cart", JSON.stringify(cart));
  updateCartCount();
  showToast(`${product.name} added to cart`, "success");
};

const removeFromCart = (productId) => {
  let newCart = [];
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id !== productId) {
      newCart.push(cart[i]);
    }
  }
  cart = newCart;
  localStorage.setItem("insidelautech_cart", JSON.stringify(cart));
  updateCartCount();
};

const updateQuantity = (productId, newQuantity) => {
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].id === productId) {
      if (newQuantity <= 0) {
        removeFromCart(productId);
      } else {
        cart[i].quantity = newQuantity;
        localStorage.setItem("insidelautech_cart", JSON.stringify(cart));
      }
      break;
    }
  }
};

const getCartTotal = () => {
  let total = 0;
  for (let i = 0; i < cart.length; i++) {
    total = total + cart[i].price * cart[i].quantity;
  }
  return total;
};

const checkSession = () => {
  const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
  const session = localStorage.getItem("insidelautech_session");
  if (session) {
    try {
      const user = JSON.parse(session);
      if (!user.loggedIn) {
        localStorage.removeItem("insidelautech_session");
        return null;
      }

      const referenceTime = user.lastLoginAt || user.loginTime;
      const parsedTime = referenceTime ? new Date(referenceTime).getTime() : NaN;

      if (!Number.isFinite(parsedTime)) {
        localStorage.removeItem("insidelautech_session");
        return null;
      }

      if (Date.now() - parsedTime > SESSION_MAX_AGE_MS) {
        localStorage.removeItem("insidelautech_session");
        return null;
      }

      return user;
    } catch {
      localStorage.removeItem("insidelautech_session");
      return null;
    }
  }
  return null;
};

const logout = () => {
  const redirectToHome = () => {
    localStorage.clear();
    if (window.location.pathname.includes("/pages/")) {
      window.location.href = "../index.html";
    } else {
      window.location.href = "index.html";
    }
  };

  if (typeof makeApiRequest === "function" && window.API_CONFIG) {
    makeApiRequest(API_CONFIG.endpoints.auth.logout || "/api/auth/logout", {
      method: "POST",
      includeAuth: true,
    })
      .catch(() => null)
      .finally(redirectToHome);
    return;
  }

  redirectToHome();
};

const generateDeliveryCode = () => {
  const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return code;
};

const createOrder = (items, total, userId, userName, userEmail, paymentRef) => {
  const orders = JSON.parse(
    localStorage.getItem("insidelautech_orders") || "[]",
  );
  const newOrder = {
    orderId: `ORD-${Date.now()}`,
    userId: userEmail,
    userName: userName,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
    })),
    total: total,
    paymentRef: paymentRef,
    deliveryCode: generateDeliveryCode(),
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveredAt: null,
  };

  orders.push(newOrder);
  localStorage.setItem("insidelautech_orders", JSON.stringify(orders));
  return newOrder;
};

const payWithPaystack = ({
  amount,
  email,
  reference,
  metadata,
  onSuccess,
  onCancel,
}) => {
  if (!window.PaystackPop) {
    ensurePaystackScript()
      .then(() => {
        payWithPaystack({
          amount,
          email,
          reference,
          metadata,
          onSuccess,
          onCancel,
        });
      })
      .catch(() => {
        showToast(
          "Unable to load Paystack right now. Check your internet and try again.",
          "error",
        );
      });
    return;
  }

  if (!PAYSTACK_PUBLIC_KEY || PAYSTACK_PUBLIC_KEY.includes("xxxxxxxx")) {
    showToast("Set your Paystack test public key before checkout.", "warning");
    return;
  }

  const amountInKobo = Math.round(Number(amount) * 100);
  if (!amountInKobo || amountInKobo <= 0) {
    showToast("Invalid payment amount.", "error");
    return;
  }

  const handler = window.PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: amountInKobo,
    currency: "NGN",
    ref: reference || `INSIDE-${Date.now()}`,
    metadata: metadata || {},
    callback: (response) => {
      if (onSuccess) {
        onSuccess(response);
      }
    },
    onClose: () => {
      if (onCancel) {
        onCancel();
      }
    },
  });

  handler.openIframe();
};

const setPaystackTestKey = (publicKey) => {
  if (!publicKey || !publicKey.startsWith("pk_test_")) {
    showToast("Use a valid Paystack test public key (pk_test_...)", "warning");
    return;
  }
  localStorage.setItem("insidelautech_paystack_test_key", publicKey);
  showToast("Paystack test key saved. Refresh to use it.", "success");
};

const getFallbackImage = (label = "Product", width = 300, height = 200) => {
  const safeLabel = String(label)
    .slice(0, 42)
    .replace(/[<>&"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'><defs><linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='#f5efe0'/><stop offset='100%' stop-color='#efe2c2'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#bg)'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#7f642e' font-size='16' font-family='Segoe UI, Arial, sans-serif'>${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const updateNav = () => {
  const user = checkSession();
  const loginLink = document.getElementById("loginLink");
  const signupLink = document.getElementById("signupLink");
  const cartLink = document.getElementById("cartNavLink");
  const productsCtaLink = document.getElementById("productsCtaLink");
  const productsNavLinks = document.querySelectorAll(
    ".navbar-nav .nav-link[href]",
  );

  const setNavVisibility = (element, isVisible) => {
    if (!element) {
      return;
    }
    const target = element.closest(".nav-item") || element;
    target.style.display = isVisible ? "" : "none";
  };

  const loginHref = window.location.pathname.includes("/pages/")
    ? "login.html"
    : "pages/login.html";
  const signupHref = window.location.pathname.includes("/pages/")
    ? "signup.html"
    : "pages/signup.html";
  const dashboardHref = window.location.pathname.includes("/pages/")
    ? "dashboard.html"
    : "pages/dashboard.html";

  if (cartLink) {
    setNavVisibility(cartLink, !!user);
  }

  if (productsNavLinks.length) {
    productsNavLinks.forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.includes("products.html")) {
        setNavVisibility(link, !!user);
      }
    });
  }

  if (productsCtaLink) {
    if (user) {
      productsCtaLink.href = "pages/products.html";
      productsCtaLink.textContent = "View All Products";
    } else {
      productsCtaLink.href = "pages/signup.html";
      productsCtaLink.textContent = "Sign Up to View Products";
    }
  }

  if (user) {
    if (loginLink) {
      loginLink.innerHTML = '<i class="bi bi-person-circle"></i> Dashboard';
      loginLink.href = dashboardHref;
    }

    if (signupLink) {
      signupLink.innerHTML = "Logout";
      signupLink.href = "#";
      signupLink.onclick = (e) => {
        e.preventDefault();
        logout();
      };
    }
  } else {
    if (loginLink) {
      loginLink.textContent = "Login";
      loginLink.href = loginHref;
    }

    if (signupLink) {
      signupLink.textContent = "Sign Up";
      signupLink.href = signupHref;
      signupLink.onclick = null;
    }
  }
};

const highlightCurrentNavLink = () => {
  const navLinks = document.querySelectorAll(".navbar-nav .nav-link[href]");
  if (!navLinks.length) {
    return;
  }

  const currentPath = window.location.pathname.split("/").pop() || "index.html";

  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const normalizedHref = href.split("?")[0].split("#")[0];
    const targetPath = normalizedHref.split("/").pop();

    if (!targetPath) {
      return;
    }

    const shouldBeActive =
      targetPath === currentPath ||
      (currentPath === "index.html" &&
        (targetPath === "index.html" || targetPath === ""));

    if (shouldBeActive) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
};

const setupNavbarBehavior = () => {
  const navbar = document.querySelector(".navbar");
  if (!navbar) {
    return;
  }

  const handleNavbarScroll = () => {
    if (window.scrollY > 10) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }
  };

  handleNavbarScroll();
  window.addEventListener("scroll", handleNavbarScroll);

  const navLinks = document.querySelectorAll(".navbar-nav .nav-link");
  const navbarToggler = document.querySelector(".navbar-toggler");
  const navbarCollapse = document.querySelector(".navbar-collapse");

  if (navbarToggler && navbarCollapse && navLinks.length) {
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (
          window.innerWidth < 992 &&
          navbarCollapse.classList.contains("show")
        ) {
          navbarToggler.click();
        }
      });
    });
  }
};

const products = Array.isArray(window.INSIDE_PRODUCTS)
  ? window.INSIDE_PRODUCTS
  : [];
const priceOverridePayload = window.INSIDE_PRICE_OVERRIDES || null;

const enhanceProductImageUrl = (url) => {
  if (!url || typeof url !== "string") {
    return url;
  }

  if (url.includes("i.pinimg.com/236x/")) {
    return url.replace("i.pinimg.com/236x/", "i.pinimg.com/736x/");
  }

  return url;
};

for (let i = 0; i < products.length; i++) {
  products[i].image = enhanceProductImageUrl(products[i].image);
}

if (priceOverridePayload && priceOverridePayload.overrides) {
  for (let i = 0; i < products.length; i++) {
    const overrideValue =
      priceOverridePayload.overrides[String(products[i].id)];
    const numericOverride = Number(overrideValue);
    if (Number.isFinite(numericOverride) && numericOverride > 0) {
      products[i].price = Math.round(numericOverride);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const activeUser = checkSession();
  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  const isPublicLanding =
    currentPath === "index.html" &&
    !window.location.pathname.includes("/pages/");

  if (activeUser && isPublicLanding) {
    window.location.href = "pages/dashboard.html";
    return;
  }

  ensureToastContainer();
  updateCartCount();
  updateNav();
  highlightCurrentNavLink();
  setupNavbarBehavior();
});

window.showToast = showToast;
window.payWithPaystack = payWithPaystack;
window.setPaystackTestKey = setPaystackTestKey;
window.getFallbackImage = getFallbackImage;
window.createOrder = createOrder;
window.generateDeliveryCode = generateDeliveryCode;
