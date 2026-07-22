    // ----------------------------------------------------
    // DONNÉES ET CONFIGURATION PAR DÉFAUT
    // ----------------------------------------------------
    const defaultSections = [
      "A - Z (COMPRIMÉS)",
      "ANNEXE 2",
      "ARMOIRE NARCOTIQUES",
      "CRÈMES, ONG., SUPPOS.",
      "CYTOTOXIQUES",
      "DISPILLS - A - Z",
      "DISPILLS - CYTOTOXIQUES",
      "DISPILLS - SUBS. CIBLÉES",
      "FRIGO",
      "GOUTTES OPHTALMIQUES",
      "INJECTIONS",
      "LAB.",
      "LAIT MATERNISÉS",
      "LIQUIDES ET SUSPENSIONS",
      "MAGISTRALES",
      "PANSEMENTS",
      "VAPORISATEURS / INHALATEURS",
      "VITAMINES / SUPPLÉMENTS"
    ];

    const defaultStickerColors = {
      "01": { "name": "Rouge", "color": "#EF5350" },
      "02": { "name": "Rose", "color": "#EC407A" },
      "03": { "name": "Violet", "color": "#AB47BC" },
      "04": { "name": "Bleu Foncé", "color": "#5C6BC0" },
      "05": { "name": "Bleu Clair", "color": "#29B6F6" },
      "06": { "name": "Vert", "color": "#66BB6A" },
      "07": { "name": "Jaune", "color": "#FFCA28" },
      "08": { "name": "Orange", "color": "#FFA726" },
      "09": { "name": "Brun", "color": "#8D6E63" },
      "10": { "name": "Lime", "color": "#D4E157" },
      "11": { "name": "Cyan", "color": "#26C6DA" },
      "12": { "name": "Gris", "color": "#BDC3C7" }
    };

    // ----------------------------------------------------
    // ÉTAT GLOBAL DE L'APPLICATION
    // ----------------------------------------------------
    let state = {
      products: [],
      config: {
        expiryWindowMonths: 3,
        sections: [],
        stickerColors: {}
      },
      currentDate: new Date("2026-06-23"),
      targetMonthDate: new Date("2026-06-23"),
      sessionInitials: "",
      tourneeStartMonth: "2026-08",
      tourneeDuration: 6,
      sorting: { key: 'expiryDate', direction: 'asc' },
      sectionsProgress: {}
    };

    let localCatalog = [];
    let tempScannedUPC = "";

    // ----------------------------------------------------
    // CONNEXION ET CONTEXTE CLOUD SUPABASE
    // ----------------------------------------------------
    const SUPABASE_URL = "https://hhmwlzaeipyrowwjlbbj.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhobXdsemFlaXB5cm93d2psYmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDM5NjYsImV4cCI6MjA5OTE3OTk2Nn0.vv1Zw3oFDilKSxh7FEocWi8Y2pzu7uX1rf_L0Jhf1m4";
    
    let supabaseClient = null;
    let sessionUser = null;
    let sessionProfile = null;
    let sessionPharmacy = null;

    let db = null;
    let showAllRecent = false;
    const DB_NAME = "ExpiresLabDB";
    const DB_VERSION = 1;

    // ----------------------------------------------------
    // INITIALISATION DE L'APPLICATION ET CLOUD
    // ----------------------------------------------------
    async function init() {
      try {
        console.log("Initialisation de l'application...");
        
        if (!window.supabase) {
          throw new Error("La bibliothèque Supabase n'a pas pu être chargée. Veuillez vérifier votre connexion internet.");
        }
        
        // 1. Initialiser le client Supabase
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // 2. Configurer les écouteurs d'événements de base et d'auth
        setupEventHandlers();
        setupAuthEventHandlers();
        
        // 3. Vérifier s'il y a une session active
        await checkAuthSession();

        // 4. Enregistrer le Service Worker pour le support PWA (V3.8)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker enregistré', reg.scope))
            .catch(err => console.error('[PWA] Erreur Service Worker', err));
        }
      } catch (err) {
        console.error("Erreur critique d'initialisation :", err);
        alert("Erreur d'initialisation : " + err.message + "\n\n(Vérifiez que vous êtes connecté à internet)");
      }
    }

    async function checkAuthSession() {
      showLoading("Vérification de la session...");
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error || !session) {
        hideLoading();
        showAuthScreen();
        return;
      }
      
      await handleLoginSuccess(session.user);
    }

    function showAuthScreen() {
      document.getElementById("login-container").style.display = "flex";
      document.getElementById("main-app-wrapper").style.display = "none";
      
      // Gérer l'affichage d'invitation (V3.7)
      const urlParams = new URLSearchParams(window.location.search);
      const inviteId = urlParams.get("invite");
      const inviteName = urlParams.get("name");
      
      const inviteAlert = document.getElementById("reg-invite-alert");
      const nameGroup = document.getElementById("reg-pharmacy-name-group");
      
      if (inviteId && inviteName) {
        // Mode invitation : pré-configurer le formulaire d'inscription
        document.getElementById("login-form").style.display = "none";
        document.getElementById("register-form").style.display = "block";
        document.getElementById("login-header").querySelector("h2").textContent = "Rejoindre une pharmacie";
        
        if (inviteAlert) {
          inviteAlert.innerHTML = `👋 Vous êtes invité(e) à rejoindre la pharmacie :<br><strong>${decodeURIComponent(inviteName)}</strong>`;
          inviteAlert.style.display = "block";
        }
        if (nameGroup) {
          nameGroup.style.display = "none";
          const nameInput = document.getElementById("reg-pharmacy-name");
          nameInput.value = decodeURIComponent(inviteName);
          nameInput.required = false;
        }
      } else {
        // Mode normal
        if (inviteAlert) inviteAlert.style.display = "none";
        if (nameGroup) {
          nameGroup.style.display = "block";
          document.getElementById("reg-pharmacy-name").required = true;
        }
      }
    }

    function hideAuthScreen() {
      document.getElementById("login-container").style.display = "none";
      document.getElementById("main-app-wrapper").style.display = "block";
    }

    function showLoading(text) {
      document.getElementById("login-loading").style.display = "flex";
      document.getElementById("login-loading-text").textContent = text;
    }

    function hideLoading() {
      document.getElementById("login-loading").style.display = "none";
    }

    function showError(message) {
      const errDiv = document.getElementById("login-error-msg");
      errDiv.textContent = message;
      errDiv.style.display = "block";
    }

    async function handleLoginSuccess(user) {
      sessionUser = user;
      showLoading("Chargement de votre profil...");
      
      try {
        const { data: profile, error: profError } = await supabaseClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
          
        if (profError) throw profError;
        if (!profile) throw new Error("Profil utilisateur introuvable.");
        
        sessionProfile = profile;
        if (!profile.pharmacy_id) throw new Error("Votre compte n'est lié à aucune pharmacie.");
        
        const { data: pharmacy, error: pharmError } = await supabaseClient
          .from("pharmacies")
          .select("*")
          .eq("id", profile.pharmacy_id)
          .single();
          
        if (pharmError) throw pharmError;
        
        sessionPharmacy = pharmacy;
        document.getElementById("header-pharmacy-name").textContent = pharmacy.name;
        const printPharm = document.getElementById("print-pharmacy-subtitle");
        if (printPharm) printPharm.textContent = pharmacy.name;
        document.getElementById("header-user-email").textContent = user.email;
        
        if (profile.initials) {
          state.sessionInitials = profile.initials;
          const initialsInput = document.getElementById("session-initials");
          if (initialsInput) initialsInput.value = profile.initials;
          const formTech = document.getElementById("form-tech");
          if (formTech) formTech.value = profile.initials;
        }
        
        hideAuthScreen();
        await loadDataFromSupabase();
        await checkAndMigrateLocalData();
        checkAndShowTutorial();
      } catch (err) {
        console.error("Erreur de profil", err);
        hideLoading();
        showError("Erreur d'accès : " + (err.message || "Impossible de charger votre compte."));
      } finally {
        hideLoading();
      }
    }

    async function loadDataFromSupabase() {
      showLoading("Chargement des données de la pharmacie...");
      try {
        const { data: configData, error: configError } = await supabaseClient
          .from("configurations")
          .select("*")
          .eq("pharmacy_id", sessionPharmacy.id)
          .maybeSingle();
          
        if (configError) throw configError;
        
        if (configData) {
          state.config = {
            expiryWindowMonths: configData.expiry_window_months,
            sections: configData.sections,
            stickerColors: configData.sticker_colors || {}
          };
          state.sectionsProgress = state.config.stickerColors._sectionsProgress || {};
        } else {
          state.config = {
            expiryWindowMonths: 6,
            sections: [...defaultSections],
            stickerColors: { ...defaultStickerColors }
          };
          state.sectionsProgress = {};
          await saveConfigToSupabaseCloud();
        }
        
        state.tourneeDuration = state.config.expiryWindowMonths;
        
        const { data: productsData, error: productsError } = await supabaseClient
          .from("flagged_products")
          .select("*")
          .eq("pharmacy_id", sessionPharmacy.id);
          
        if (productsError) throw productsError;
        
        state.products = (productsData || []).map(p => ({
          id: p.id,
          section: p.section,
          din: p.din,
          product: p.product,
          quantity: p.quantity,
          expiryDate: p.expiry_date,
          status: p.status,
          dateAdded: p.date_added,
          techInitials: p.tech_initials,
          removalDate: p.removal_date,
          removedBy: p.removed_by,
          notes: p.notes,
          dosage: p.dosage || "",
          format: p.format || "",
          upc: p.upc || ""
        }));
        
        await loadSupabaseCatalogToMemory();
        populateSectionDropdowns();
        initializeTourneeSelects();
        renderAllViews();
        
      } catch (err) {
        console.error("Erreur loadData", err);
        showToast("Erreur de chargement des données : " + err.message, "danger");
      } finally {
        hideLoading();
      }
    }

    async function loadSupabaseCatalogToMemory() {
      if (!sessionPharmacy) return;
      
      let allData = [];
      let start = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      try {
        while (hasMore) {
          const { data, error } = await supabaseClient
            .from("catalog")
            .select("din, product, dosage, format, upc")
            .eq("pharmacy_id", sessionPharmacy.id)
            .range(start, start + pageSize - 1);
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = allData.concat(data);
            start += pageSize;
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }
        localCatalog = allData;
      } catch (err) {
        console.error("Erreur catalogue memory", err);
        localCatalog = [];
      }
      updateCatalogStatsUI();
    }

    function updateCatalogStatsUI() {
      const statsText = document.getElementById("catalog-stats-text");
      if (statsText) {
        statsText.textContent = `Le référentiel contient actuellement ${localCatalog.length} produit(s) enregistré(s).`;
      }
    }

    async function saveProducts() {
      if (!sessionPharmacy) return;
      
      try {
        if (state.products.length > 0) {
          const dbProducts = state.products.map(p => ({
            id: p.id,
            pharmacy_id: sessionPharmacy.id,
            section: p.section,
            din: p.din,
            product: p.product,
            quantity: p.quantity,
            expiry_date: p.expiryDate,
            status: p.status,
            date_added: p.dateAdded,
            tech_initials: p.techInitials,
            removal_date: p.removalDate,
            removed_by: p.removedBy,
            notes: p.notes,
            dosage: p.dosage || "",
            format: p.format || "",
            upc: p.upc || ""
          }));
          const { error } = await supabaseClient.from("flagged_products").upsert(dbProducts);
          if (error) throw error;
        }
        
        const localIds = state.products.map(p => p.id);
        if (localIds.length > 0) {
          const { error: deleteError } = await supabaseClient
            .from("flagged_products")
            .delete()
            .eq("pharmacy_id", sessionPharmacy.id)
            .not("id", "in", `(${localIds.join(",")})`);
          if (deleteError) throw deleteError;
        } else {
          const { error: deleteAllError } = await supabaseClient
            .from("flagged_products")
            .delete()
            .eq("pharmacy_id", sessionPharmacy.id);
          if (deleteAllError) throw deleteAllError;
        }
      } catch (err) {
        console.error("Erreur de sauvegarde produits cloud", err);
        showToast("Erreur de synchronisation Cloud : " + err.message, "danger");
      }
    }

    async function saveConfig() {
      await saveConfigToSupabaseCloud();
    }

    async function saveConfigToSupabaseCloud() {
      if (!sessionPharmacy) return;
      try {
        state.config.stickerColors._sectionsProgress = state.sectionsProgress || {};
        const { error } = await supabaseClient
          .from("configurations")
          .upsert({
            pharmacy_id: sessionPharmacy.id,
            expiry_window_months: state.config.expiryWindowMonths,
            sections: state.config.sections,
            sticker_colors: state.config.stickerColors,
            updated_at: new Date().toISOString()
          });
          
        if (error) throw error;
      } catch (err) {
        console.error("Erreur sauvegarde config cloud", err);
        showToast("Erreur config Cloud : " + err.message, "danger");
      }
    }

    async function checkAndMigrateLocalData() {
      const localProductsRaw = localStorage.getItem("exp_products");
      const localConfigRaw = localStorage.getItem("exp_config");
      
      let hasLocalProducts = false;
      let hasLocalConfig = false;
      let localProducts = [];
      let localConfig = null;
      
      if (localProductsRaw) {
        try {
          localProducts = JSON.parse(localProductsRaw);
          hasLocalProducts = localProducts.length > 0 && !localProducts.every(p => p.id.startsWith("demo-"));
        } catch (e) {
          console.error(e);
        }
      }
      
      if (localConfigRaw) {
        try {
          localConfig = JSON.parse(localConfigRaw);
          hasLocalConfig = localConfig && localConfig.sections && localConfig.sections.length > 0;
        } catch (e) {
          console.error(e);
        }
      }
      
      if (!hasLocalProducts && !hasLocalConfig) return;
      
      const confirmMigration = confirm(
        "Des données locales (produits saisis ou configurations) ont été détectées sur cet ordinateur.\n\n" +
        "Voulez-vous les fusionner et les envoyer sur votre compte Cloud Supabase ?\n" +
        "(Recommandé pour ne pas perdre votre travail en cours)"
      );
      
      if (!confirmMigration) {
        localStorage.removeItem("exp_products");
        localStorage.removeItem("exp_config");
        return;
      }
      
      showLoading("Migration de vos données locales vers le Cloud...");
      
      try {
        if (hasLocalConfig) {
          state.config = {
            expiryWindowMonths: localConfig.expiryWindowMonths || state.config.expiryWindowMonths,
            sections: localConfig.sections || state.config.sections,
            stickerColors: localConfig.stickerColors || state.config.stickerColors
          };
          state.sectionsProgress = state.config.stickerColors._sectionsProgress || {};
          await saveConfigToSupabaseCloud();
        }
        
        if (hasLocalProducts) {
          const productsToMigrate = localProducts.filter(p => !p.id.startsWith("demo-"));
          if (productsToMigrate.length > 0) {
            productsToMigrate.forEach(localP => {
              const exists = state.products.some(p => p.id === localP.id);
              if (!exists) {
                state.products.push(localP);
              }
            });
            await saveProducts();
          }
        }
        
        showToast("Migration réussie ! Vos données locales sont maintenant sauvegardées dans le Cloud.", "success");
        localStorage.removeItem("exp_products");
        localStorage.removeItem("exp_config");
        renderAllViews();
        
      } catch (err) {
        console.error("Erreur pendant la migration", err);
        showToast("Erreur lors de la migration : " + err.message, "danger");
      } finally {
        hideLoading();
      }
    }

    function setupAuthEventHandlers() {
      document.getElementById("link-show-register").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("login-form").style.display = "none";
        document.getElementById("register-form").style.display = "block";
        document.getElementById("login-header").querySelector("h2").textContent = "Créer un compte";
        document.getElementById("login-error-msg").style.display = "none";
      });
      
      document.getElementById("link-show-login").addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById("login-form").style.display = "block";
        document.getElementById("register-form").style.display = "none";
        document.getElementById("login-header").querySelector("h2").textContent = "Gestion des Expirés";
        document.getElementById("login-error-msg").style.display = "none";
      });
      
      document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        
        if (!email || !password) {
          showError("Veuillez saisir votre courriel et votre mot de passe.");
          return;
        }

        showLoading("Connexion en cours...");
        document.getElementById("login-error-msg").style.display = "none";
        
        try {
          const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
          
          if (error) {
            hideLoading();
            let msg = error.message;
            if (msg === "Invalid login credentials") {
              msg = "Courriel ou mot de passe incorrect.";
            } else if (msg === "Email not confirmed") {
              msg = "Adresse courriel non confirmée.";
            }
            showError("Erreur de connexion : " + msg);
            return;
          }
          
          if (!data || !data.user) {
            hideLoading();
            showError("Erreur de connexion : Compte introuvable.");
            return;
          }

          await handleLoginSuccess(data.user);
        } catch (err) {
          console.error("Erreur de soumission login:", err);
          hideLoading();
          showError("Erreur de connexion : " + (err.message || "Impossible de communiquer avec le serveur."));
        }
      });
      
      document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const initials = document.getElementById("reg-initials").value.toUpperCase().trim();
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;
        
        // Lire le paramètre d'invitation éventuel
        const urlParams = new URLSearchParams(window.location.search);
        const inviteId = urlParams.get("invite");
        
        showLoading("Création du compte...");
        document.getElementById("login-error-msg").style.display = "none";
        
        try {
          let targetPharmacyId = inviteId;
          
          if (!targetPharmacyId) {
            // MODE NORMAL : Création d'une nouvelle pharmacie
            const pharmacyName = document.getElementById("reg-pharmacy-name").value;
            
            // 1. Créer la pharmacie d'abord
            const { data: pharmData, error: pharmError } = await supabaseClient
              .from("pharmacies")
              .insert({ name: pharmacyName })
              .select()
              .single();
              
            if (pharmError) throw pharmError;
            targetPharmacyId = pharmData.id;
            
            // 2. S'inscrire en liant la nouvelle pharmacie
            const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
              email,
              password,
              options: {
                data: {
                  pharmacy_id: targetPharmacyId,
                  initials: initials
                }
              }
            });
            
            if (signUpError) throw signUpError;
            
            const user = signUpData.user;
            if (!user) throw new Error("Une erreur s'est produite lors de la création de l'utilisateur.");
            
            if (signUpData.session) {
              await supabaseClient.auth.setSession(signUpData.session);
            }
            
            // 3. Créer la configuration par défaut (attendre un peu le trigger profile)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { error: configError } = await supabaseClient
              .from("configurations")
              .insert({
                pharmacy_id: targetPharmacyId,
                expiry_window_months: 6,
                sections: defaultSections,
                sticker_colors: defaultStickerColors
              });
              
            if (configError) throw configError;
            
            // Précharger le catalogue
            showLoading("Préconfiguration du catalogue...");
            await preloadDefaultCatalog(targetPharmacyId);
            
            showToast("Compte créé avec succès !", "success");
            await handleLoginSuccess(user);
          } else {
            // MODE INVITATION : Rejoindre une pharmacie existante
            const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
              email,
              password,
              options: {
                data: {
                  pharmacy_id: targetPharmacyId,
                  initials: initials
                }
              }
            });
            
            if (signUpError) throw signUpError;
            
            const user = signUpData.user;
            if (!user) throw new Error("Une erreur s'est produite lors de la création de l'utilisateur.");
            
            if (signUpData.session) {
              await supabaseClient.auth.setSession(signUpData.session);
            }
            
            showToast("Vous avez rejoint la pharmacie avec succès !", "success");
            
            // Nettoyer l'URL de l'invitation pour éviter les réinscriptions par erreur
            window.history.replaceState({}, document.title, window.location.pathname);
            
            await handleLoginSuccess(user);
          }
          
        } catch (err) {
          console.error(err);
          showError("Erreur lors de l'inscription : " + err.message);
          await supabaseClient.auth.signOut();
          hideLoading();
        }
      });
      
      document.getElementById("btn-logout").addEventListener("click", async () => {
        if (confirm("Voulez-vous vous déconnecter ?")) {
          showLoading("Déconnexion...");
          await supabaseClient.auth.signOut();
          sessionUser = null;
          sessionProfile = null;
          sessionPharmacy = null;
          state.products = [];
          localCatalog = [];
          hideLoading();
          showAuthScreen();
          showToast("Vous avez été déconnecté.", "info");
        }
      });
    }

    // Remplir les listes déroulantes de l'assistant de tournée flexible (V3)
    function initializeTourneeSelects() {
      const selectMonth = document.getElementById("assistant-start-month");
      const selectDuration = document.getElementById("assistant-duration");

      // Remplir le mois de début de la tournée (de M-1 à M+6 pour offrir du choix)
      selectMonth.innerHTML = "";
      
      const startSeed = new Date(state.currentDate);
      startSeed.setMonth(startSeed.getMonth() - 1); // Commencer à M-1 pour flexibilité

      for (let i = 0; i < 9; i++) {
        const loopDate = new Date(startSeed);
        loopDate.setMonth(loopDate.getMonth() + i);
        
        const year = loopDate.getFullYear();
        const monthNum = String(loopDate.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${monthNum}`;

        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = formatMonthYearFrench(loopDate);
        
        // Par défaut: sélectionner M+2 (Août 2026 si courant Juin 2026)
        const defaultTargetDate = new Date(state.currentDate);
        defaultTargetDate.setMonth(defaultTargetDate.getMonth() + 2);
        const defaultTargetKey = `${defaultTargetDate.getFullYear()}-${String(defaultTargetDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (key === defaultTargetKey) {
          opt.selected = true;
          state.tourneeStartMonth = key;
        }

        selectMonth.appendChild(opt);
      }

      // Remplir la durée
      selectDuration.value = state.tourneeDuration;

      // Définir la date d'expiration par défaut du formulaire de saisie sur le mois cible de départ
      document.getElementById("form-expiry").value = state.tourneeStartMonth;
      updateFormStickerPreview(state.tourneeStartMonth);
    }

    // ----------------------------------------------------
    // ÉCOUTEURS D'ÉVÉNEMENTS
    // ----------------------------------------------------
    function setupEventHandlers() {
      // Navigation des onglets
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
          
          btn.classList.add("active");
          const tabId = btn.getAttribute("data-tab");
          document.getElementById(tabId).classList.add("active");

          // Forcer la synchronisation des sections à chaque changement d'onglet
          populateSectionDropdowns();
        });
      });

      // Basculement de thème
      const themeBtn = document.getElementById("theme-toggle-btn");
      themeBtn.addEventListener("click", () => {
        const doc = document.documentElement;
        if (doc.getAttribute("data-theme") === "dark") {
          doc.removeAttribute("data-theme");
          localStorage.setItem("theme", "light");
        } else {
          doc.setAttribute("data-theme", "dark");
          localStorage.setItem("theme", "dark");
        }
      });
      if (localStorage.getItem("theme") === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      }

      // Initiales du technicien
      document.getElementById("session-initials").addEventListener("input", (e) => {
        const initials = e.target.value.toUpperCase().trim();
        state.sessionInitials = initials;
        localStorage.setItem("exp_tech_initials", initials);
        document.getElementById("form-tech").value = initials;
      });

      // Intercepter la touche Entrée sur le champ quantité si elle provient d'un scan automatique (V3.9)
      document.getElementById("form-qty").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && window.justScanned) {
          e.preventDefault();
          console.log("[Scanner] Touche Entrée bloquée sur la quantité suite au scan automatique.");
        }
      });

      // Empêcher la soumission accidentelle du formulaire par Entrée sur les autres champs (V3.9)
      document.getElementById("product-form").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const activeEl = document.activeElement;
          if (activeEl && activeEl.id !== "form-qty" && activeEl.type !== "submit" && activeEl.tagName !== "BUTTON") {
            e.preventDefault();
          }
        }
      });

      // Navigation des mois de retrait
      document.getElementById("prev-target-month").addEventListener("click", () => {
        state.targetMonthDate.setMonth(state.targetMonthDate.getMonth() - 1);
        updateDateDisplays();
        renderAllViews();
      });
      document.getElementById("next-target-month").addEventListener("click", () => {
        state.targetMonthDate.setMonth(state.targetMonthDate.getMonth() + 1);
        updateDateDisplays();
        renderAllViews();
      });

      // Changement de date sur le formulaire de saisie
      document.getElementById("form-expiry").addEventListener("input", (e) => {
        updateFormStickerPreview(e.target.value);
      });

      // Changement de paramètres sur l'assistant de tournée flexible (V3)
      document.getElementById("assistant-start-month").addEventListener("change", (e) => {
        state.tourneeStartMonth = e.target.value;
        // Ajuster l'input d'expiration du formulaire par commodité
        document.getElementById("form-expiry").value = e.target.value;
        updateFormStickerPreview(e.target.value);
        updateTourneeAssistant();
      });
      document.getElementById("assistant-duration").addEventListener("change", (e) => {
        state.tourneeDuration = parseInt(e.target.value);
        updateTourneeAssistant();
      });

      // Soumission d'enregistrement produit
      document.getElementById("product-form").addEventListener("submit", (e) => {
        e.preventDefault();
        addNewProduct();
      });

      // Configuration : cycle par défaut
      document.querySelectorAll("input[name='tournee-cycle-default']").forEach(radio => {
        radio.addEventListener("change", (e) => {
          state.config.expiryWindowMonths = parseInt(e.target.value);
          saveConfig();
          showToast(`Paramètre par défaut mis à jour : ${state.config.expiryWindowMonths} mois.`, "success");
        });
      });

      // Modaux
      document.getElementById("close-checkout-modal").addEventListener("click", closeCheckoutModal);
      document.getElementById("btn-cancel-checkout").addEventListener("click", closeCheckoutModal);
      document.getElementById("btn-confirm-checkout").addEventListener("click", confirmCheckout);
      
      document.getElementById("close-edit-modal").addEventListener("click", closeEditModal);
      document.getElementById("btn-cancel-edit").addEventListener("click", closeEditModal);
      document.getElementById("btn-save-edit").addEventListener("click", saveProductEdits);

      // Modal Importation Backup
      document.getElementById("close-import-modal").addEventListener("click", closeImportModal);
      document.getElementById("btn-cancel-import").addEventListener("click", closeImportModal);
      document.getElementById("btn-merge-import").addEventListener("click", confirmMergeImport);
      document.getElementById("btn-replace-import").addEventListener("click", confirmReplaceImport);

      // Toggle pliage/dépliage récents
      document.getElementById("btn-toggle-recent-entries").addEventListener("click", () => {
        showAllRecent = !showAllRecent;
        renderRecentEntries();
      });

      // Filtres & tris d'inventaire
      document.getElementById("filter-search").addEventListener("input", () => renderInventoryTable());
      document.getElementById("filter-section").addEventListener("change", () => renderInventoryTable());
      document.getElementById("filter-month").addEventListener("change", () => renderInventoryTable());
      document.getElementById("filter-status").addEventListener("change", () => renderInventoryTable());

      // Changement de source d'inventaire (signalés vs catalogue complet)
      document.querySelectorAll("input[name='inventory-source']").forEach(radio => {
        radio.addEventListener("change", () => {
          document.getElementById("filter-search").value = "";
          renderInventoryTable();
        });
      });

      // Ajout de section
      document.getElementById("add-section-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("new-section-name");
        const newSec = input.value.toUpperCase().trim();
        if (newSec && !state.config.sections.includes(newSec)) {
          state.config.sections.push(newSec);
          state.config.sections.sort();
          saveConfig();
          populateSectionDropdowns();
          renderConfigPanel();
          showToast(`Section "${newSec}" ajoutée !`, "success");
          input.value = "";
        }
      });

      // Exports / Imports généraux
      document.getElementById("btn-backup-export").addEventListener("click", exportBackupJSON);
      document.getElementById("import-file-input").addEventListener("change", importBackupJSON);
      document.getElementById("btn-export-csv-all").addEventListener("click", exportAllToCSV);
      document.getElementById("btn-export-csv-month").addEventListener("click", exportMonthToCSV);
      document.getElementById("btn-reset-db").addEventListener("click", resetDatabase);
      document.getElementById("btn-reset-tutorial").addEventListener("click", () => {
        localStorage.removeItem("exp_skip_tutorial");
        showToast("Tutoriel de démarrage réactivé.", "success");
      });

      document.getElementById("btn-copy-invite-link").addEventListener("click", () => {
        const inviteInput = document.getElementById("config-invite-link");
        if (inviteInput && inviteInput.value) {
          navigator.clipboard.writeText(inviteInput.value);
          showToast("Lien d'invitation copié dans le presse-papiers !", "success");
        }
      });
      document.getElementById("btn-tutorial-close").addEventListener("click", closeTutorialModal);
      document.getElementById("btn-tutorial-guide").addEventListener("click", openGuideFromTutorial);

      // Importation et suppression du catalogue (V2)
      document.getElementById("btn-import-catalog").addEventListener("click", importCatalogCSV);
      document.getElementById("btn-clear-catalog").addEventListener("click", clearCatalogDB);
      document.getElementById("btn-import-upc").addEventListener("click", importUPCAssociationCSV);

      // Annuler l'association à la volée
      document.addEventListener("click", (e) => {
        if (e.target && e.target.id === "btn-cancel-association") {
          e.preventDefault();
          tempScannedUPC = "";
          document.getElementById("form-din").value = "";
          document.getElementById("form-product").value = "";
          document.getElementById("form-dosage").value = "";
          document.getElementById("form-format").value = "";
          const helperText = document.getElementById("scan-helper-text");
          if (helperText) helperText.style.display = "none";
          document.getElementById("form-din").focus();
          showToast("Association annulée.", "info");
        } else if (e.target && e.target.id === "btn-clear-form-selection") {
          e.preventDefault();
          tempScannedUPC = "";
          document.getElementById("form-din").value = "";
          document.getElementById("form-product").value = "";
          document.getElementById("form-dosage").value = "";
          document.getElementById("form-format").value = "";
          const helperText = document.getElementById("scan-helper-text");
          if (helperText) helperText.style.display = "none";
          document.getElementById("form-din").focus();
          showToast("Saisie effacée.", "info");
        }
      });

      // Scanner de code-barres par caméra (V3.8)
      document.getElementById("btn-scan-trigger").addEventListener("click", () => {
        startScanner();
      });
      document.getElementById("btn-camera-close").addEventListener("click", () => {
        stopScanner();
      });
      document.getElementById("btn-camera-switch").addEventListener("click", () => {
        switchCamera();
      });

      // Configuration de l'auto-complétion (V2)
      setupAutocomplete();
    }

    // ----------------------------------------------------
    // COMPOSANT: AUTO-COMPLÉTION EN TEMPS RÉEL (V2)
    // ----------------------------------------------------
    function setupAutocomplete() {
      const dinInput = document.getElementById("form-din");
      const prodInput = document.getElementById("form-product");

      // Clic en dehors pour fermer les suggestions
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".autocomplete-wrapper")) {
          closeAllSuggestions();
        }
      });

      // Événements sur l'input DIN (gestion scan et clavier)
      dinInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        const helperText = document.getElementById("scan-helper-text");
        if (helperText) helperText.style.display = "none";

        const found = checkForExactCodeMatch(val);
        if (found) {
          closeAllSuggestions();
          tempScannedUPC = ""; // Trouvé, pas besoin d'association
        } else {
          // Si le code ressemble à un UPC ou DIN inconnu (composé uniquement de chiffres et longueur >= 8)
          if (/^\d{8,15}$/.test(val)) {
            tempScannedUPC = val;
            if (helperText) {
              helperText.innerHTML = `
                <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 6px; margin-top: 8px; line-height: 1.4;">
                  <span style="color: var(--danger-color); font-weight: bold; display: block; margin-bottom: 4px;">⚠️ Code-barres inconnu : ${val}</span>
                  <span style="color: var(--text-color); font-size: 0.8rem; display: block; margin-bottom: 8px;">
                    <strong>Attention :</strong> En sélectionnant ou en saisissant un DIN maintenant, ce produit sera <strong>définitivement associé</strong> à ce code-barres.
                  </span>
                  <button type="button" class="btn btn-secondary btn-xs" id="btn-cancel-association" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; border: 1px solid var(--border-color); background: white; cursor: pointer; color: var(--text-color);">
                    Annuler l'association
                  </button>
                </div>
              `;
              helperText.style.display = "block";
            }
          } else if (val === "") {
            tempScannedUPC = "";
          }
          showSuggestions(val, "din");
        }
      });

      dinInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const val = e.target.value.trim();
          
          // 1. Vérifier match exact
          const found = checkForExactCodeMatch(val);
          if (found) {
            e.preventDefault();
            closeAllSuggestions();
            return;
          }
          
          // 2. Vérifier si suggestions ouvertes
          const suggestionsBox = document.getElementById("form-din-suggestions");
          if (suggestionsBox.style.display !== "none") {
            const rows = suggestionsBox.querySelectorAll(".autocomplete-suggestion");
            if (rows.length > 0) {
              e.preventDefault();
              rows[0].click(); // Prendre la première suggestion par défaut
              return;
            }
          }
          
          // 3. Si code-barres inconnu
          if (/^\d{8,15}$/.test(val)) {
            e.preventDefault();
            tempScannedUPC = val;
            e.target.value = ""; // Vider pour qu'ils tapent le DIN
            const helperText = document.getElementById("scan-helper-text");
            if (helperText) {
              helperText.innerHTML = `
                <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 10px; border-radius: 6px; margin-top: 8px; line-height: 1.4;">
                  <span style="color: var(--danger-color); font-weight: bold; display: block; margin-bottom: 4px;">⚠️ Code-barres scanné : ${val} (inconnu)</span>
                  <span style="color: var(--text-color); font-size: 0.8rem; display: block; margin-bottom: 8px;">
                    <strong>Attention :</strong> Saisissez le DIN correct ci-dessus pour l'associer. Ce code-barres y sera <strong>définitivement lié</strong> lors de l'enregistrement.
                  </span>
                  <button type="button" class="btn btn-secondary btn-xs" id="btn-cancel-association" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; border: 1px solid var(--border-color); background: white; cursor: pointer; color: var(--text-color);">
                    Annuler l'association
                  </button>
                </div>
              `;
              helperText.style.display = "block";
            }
            showToast("Veuillez maintenant saisir le DIN pour l'association.", "info");
            return;
          }
        }
        handleAutocompleteKeys(e, "din");
      });

      // Événements sur l'input Produit
      prodInput.addEventListener("input", (e) => {
        showSuggestions(e.target.value, "product");
      });
      prodInput.addEventListener("keydown", (e) => {
        handleAutocompleteKeys(e, "product");
      });
    }

    function closeAllSuggestions() {
      document.getElementById("form-din-suggestions").style.display = "none";
      document.getElementById("form-product-suggestions").style.display = "none";
      autocompleteHighlightIndex = -1;
    }

    function showSuggestions(val, fieldType) {
      closeAllSuggestions();
      const query = val.toLowerCase().trim();
      
      // Commencer la recherche à partir de 2 caractères
      if (query.length < 2) return;

      // Filtrer dans localCatalog (inclut la recherche par UPC)
      const matches = localCatalog.filter(item => {
        if (fieldType === "din") {
          const matchDin = item.din && item.din.toLowerCase().includes(query);
          const matchUpc = item.upc && item.upc.toLowerCase().includes(query);
          return matchDin || matchUpc;
        } else {
          return item.product.toLowerCase().includes(query);
        }
      }).slice(0, 10); // Limiter à 10 résultats

      if (matches.length === 0) return;

      const suggestionsBox = document.getElementById(`form-${fieldType}-suggestions`);
      suggestionsBox.innerHTML = "";
      suggestionsBox.style.display = "block";
      autocompleteHighlightIndex = -1;

      matches.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "autocomplete-suggestion";
        row.setAttribute("data-index", index);

        row.innerHTML = `
          <span class="sugg-name" title="${item.product}">${item.product}</span>
          <div class="sugg-details">
            <span class="sugg-din">${item.din !== 'N/A' && item.din !== '' ? item.din : ''}</span>
            <span class="sugg-dosage">${item.dosage !== 'N/A' && item.dosage !== '' ? item.dosage : ''}</span>
            <span class="sugg-format">${item.format !== 'N/A' && item.format !== '' ? item.format : ''}</span>
          </div>
        `;

        // Clic sur une suggestion
        row.addEventListener("click", () => {
          selectSuggestion(item);
        });

        suggestionsBox.appendChild(row);
      });
    }

    function checkForExactCodeMatch(val) {
      const query = val.trim();
      if (query.length < 2) return false;

      // Chercher une correspondance exacte sur DIN ou UPC
      const match = localCatalog.find(item => 
        (item.din && item.din === query) || 
        (item.upc && item.upc === query)
      );

      if (match) {
        selectSuggestion(match);
        return true;
      }
      return false;
    }

    async function saveUPCAssociation(upcCode, productDin, productName, productDosage, productFormat) {
      if (!sessionPharmacy) return;
      
      const newCatalogItem = {
        pharmacy_id: sessionPharmacy.id,
        din: productDin,
        product: productName,
        dosage: productDosage === "N/A" ? "" : productDosage,
        format: productFormat === "N/A" ? "" : productFormat,
        upc: upcCode
      };

      try {
        // Enregistrer dans Supabase catalog
        const { error } = await supabaseClient
          .from("catalog")
          .insert([newCatalogItem]);
          
        if (error) throw error;

        // Ajouter localement en mémoire
        localCatalog.push(newCatalogItem);
        showToast(`Code-barres ${upcCode} associé au DIN ${productDin} de façon permanente !`, "success");
      } catch (err) {
        console.error("Erreur d'association automatique", err);
      }
    }

    function selectSuggestion(item) {
      document.getElementById("form-din").value = (item.din === "N/A" || item.din === "") ? "" : item.din;
      document.getElementById("form-product").value = item.product;
      document.getElementById("form-dosage").value = (item.dosage === "N/A" || item.dosage === "") ? "" : item.dosage;
      document.getElementById("form-format").value = (item.format === "N/A" || item.format === "") ? "" : item.format;
      closeAllSuggestions();
      
      const helperText = document.getElementById("scan-helper-text");
      if (tempScannedUPC && helperText) {
        helperText.innerHTML = `
          <div style="background-color: #e6fffa; border: 1px solid #b2f5ea; padding: 10px; border-radius: 6px; margin-top: 8px; line-height: 1.4;">
            <span style="color: #319795; font-weight: bold; display: block; margin-bottom: 4px;">🔗 Liaison planifiée</span>
            <span style="color: var(--text-color); font-size: 0.8rem; display: block; margin-bottom: 8px;">
              Le code-barres <strong>${tempScannedUPC}</strong> sera lié au DIN <strong>${item.din || 'N/A'}</strong> (${item.product}) à l'enregistrement.
            </span>
            <button type="button" class="btn btn-secondary btn-xs" id="btn-cancel-association" style="padding: 4px 8px; font-size: 0.7rem; border-radius: 4px; border: 1px solid var(--border-color); background: white; cursor: pointer; color: var(--text-color);">
              Annuler l'association
            </button>
          </div>
        `;
        helperText.style.display = "block";
      } else if (helperText) {
        helperText.innerHTML = `
          <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Produit sélectionné.</span>
            <button type="button" id="btn-clear-form-selection" style="background: none; border: none; color: var(--danger-color); font-size: 0.75rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0;">
              [Effacer la sélection]
            </button>
          </div>
        `;
        helperText.style.display = "block";
      }

      // Activer un drapeau temporaire pour bloquer la touche Entrée automatisée de la douchette (V3.9)
      window.justScanned = true;
      setTimeout(() => { window.justScanned = false; }, 300);

      // Mettre le focus sur la quantité
      document.getElementById("form-qty").focus();
      showToast(`Produit pré-rempli : ${item.product}`, "info");
    }

    function handleAutocompleteKeys(e, fieldType) {
      const suggestionsBox = document.getElementById(`form-${fieldType}-suggestions`);
      if (suggestionsBox.style.display === "none") return;

      const rows = suggestionsBox.querySelectorAll(".autocomplete-suggestion");
      if (rows.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        autocompleteHighlightIndex = (autocompleteHighlightIndex + 1) % rows.length;
        highlightSuggestionRow(rows);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        autocompleteHighlightIndex = (autocompleteHighlightIndex - 1 + rows.length) % rows.length;
        highlightSuggestionRow(rows);
      } else if (e.key === "Enter") {
        if (autocompleteHighlightIndex !== -1) {
          e.preventDefault();
          rows[autocompleteHighlightIndex].click();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeAllSuggestions();
      }
    }

    function highlightSuggestionRow(rows) {
      rows.forEach(r => r.classList.remove("highlighted"));
      if (autocompleteHighlightIndex >= 0 && autocompleteHighlightIndex < rows.length) {
        const row = rows[autocompleteHighlightIndex];
        row.classList.add("highlighted");
        row.scrollIntoView({ block: "nearest" });
      }
    }

    // ----------------------------------------------------
    // COMPOSANT: IMPORTATION DE CATALOGUE CSV (V2)
    // ----------------------------------------------------
    function parseCSV(text) {
      if (typeof text !== "string") return [];
      // Nettoyer les caractères NUL (\0 ou \u0000) incompatibles avec PostgreSQL / Supabase
      text = text.replace(/\0/g, "").replace(/\\u0000/g, "");
      const lines = text.split(/\r?\n/);
      if (lines.length === 0) return [];

      // Trouver la ligne d'en-tête (le fichier peut avoir des lignes de titre en haut)
      let headerLineIdx = 0;
      for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("din") || line.includes("upc") || line.includes("barre") || line.includes("code-barre") || (line.includes("nom") && (line.includes("conc") || line.includes("format")))) {
          headerLineIdx = i;
          break;
        }
      }

      const firstLine = lines[headerLineIdx];
      
      // Détection de séparateur plus robuste (virgule, point-virgule, tabulation)
      let separator = ",";
      const commaCount = firstLine.split(",").length;
      const semiCount = firstLine.split(";").length;
      const tabCount = firstLine.split("\t").length;
      
      if (tabCount > commaCount && tabCount > semiCount) {
        separator = "\t";
      } else if (semiCount > commaCount) {
        separator = ";";
      }

      const headers = firstLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());

      let dinIdx = -1;
      let upcIdx = -1;
      let nameIdx = -1;
      let dosageIdx = -1;
      let formatIdx = -1;
      let unitIdx = -1;

      // 1. Première passe : Recherche stricte des termes connus
      headers.forEach((h, idx) => {
        const cleanH = h.toLowerCase().trim().replace(/’/g, "'");
        
        // UPC stricte
        if (cleanH === "upc" || cleanH.includes("barre") || cleanH.includes("barcode") || cleanH === "ean" || cleanH === "gtin") {
          upcIdx = idx;
        }
        // DIN stricte
        else if (cleanH === "din" || cleanH.includes("code produit") || cleanH.includes("code_produit") || cleanH.includes("num produit")) {
          dinIdx = idx;
        }
        // Nom stricte
        else if (cleanH.includes("nom") || cleanH.includes("produit") || cleanH.includes("desc") || cleanH.includes("name")) {
          nameIdx = idx;
        }
        // Dosage stricte
        else if (cleanH === "dosage" || cleanH === "conc." || cleanH === "conc" || cleanH.includes("force") || cleanH.includes("strength") || cleanH.includes("dos")) {
          dosageIdx = idx;
        }
        // Format/Unité stricte
        else if (cleanH.includes("unite") || cleanH.includes("unité") || cleanH === "un." || cleanH === "un" || cleanH.includes("fmt")) {
          unitIdx = idx;
        }
      });

      // 2. Deuxième passe : Si des colonnes critiques manquent toujours
      if (upcIdx === -1 || dinIdx === -1) {
        headers.forEach((h, idx) => {
          const cleanH = h.toLowerCase().trim();
          
          if (upcIdx === -1 && idx !== dinIdx && (cleanH.includes("upc") || cleanH.includes("barre") || cleanH.includes("barcode") || cleanH === "code" || cleanH === "ean")) {
            upcIdx = idx;
          }
          else if (dinIdx === -1 && idx !== upcIdx && (cleanH.includes("din") || cleanH.includes("produit") || cleanH.includes("code") || cleanH.includes("id") || cleanH.includes("ref"))) {
            dinIdx = idx;
          }
        });
      }

      // 3. Troisième passe : Résolution des chevauchements (si dinIdx === upcIdx)
      if (dinIdx === upcIdx && dinIdx !== -1) {
        const h = headers[dinIdx];
        if (h.includes("produit") || h.includes("din")) {
          upcIdx = headers.findIndex((val, idx) => idx !== dinIdx && (val.includes("code") || val.includes("upc") || val.includes("barre") || val.includes("barcode") || val.includes("ean")));
        } else {
          dinIdx = headers.findIndex((val, idx) => idx !== upcIdx && (val.includes("produit") || val.includes("din") || val.includes("code")));
        }
      }

      // 4. Quatrième passe : Détection par inspection de données si échec
      if (dinIdx === -1 || upcIdx === -1) {
        const firstRow = lines.slice(headerLineIdx + 1).find(l => l.trim() !== "");
        if (firstRow) {
          const cols = firstRow.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""));
          if (cols.length >= 2) {
            // Le DIN fait généralement 8 caractères
            if (cols[0].length === 8 && cols[1].length !== 8) {
              if (dinIdx === -1) dinIdx = 0;
              if (upcIdx === -1) upcIdx = 1;
            } else if (cols[1].length === 8 && cols[0].length !== 8) {
              if (dinIdx === -1) dinIdx = 1;
              if (upcIdx === -1) upcIdx = 0;
            }
          }
        }
      }

      // Détection du format d'acquisition parmi les colonnes restantes
      headers.forEach((h, idx) => {
        const cleanH = h.toLowerCase().trim().replace(/’/g, "'");
        if (idx === dinIdx || idx === upcIdx || idx === nameIdx || idx === dosageIdx || idx === unitIdx) return;
        if (cleanH.includes("format") || cleanH.includes("acq") || cleanH.includes("taille") || cleanH.includes("size") || cleanH.includes("cond") || cleanH.includes("emb")) {
          formatIdx = idx;
        }
      });

      if (nameIdx === -1) {
        nameIdx = headers.findIndex(h => h.includes("desc") || h.includes("nom") || h.includes("name"));
        if (nameIdx === -1) nameIdx = 1;
      }
      if (dinIdx === -1) {
        dinIdx = (upcIdx === 0) ? 1 : 0;
      }

      const results = [];
      for (let i = headerLineIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""));
        
        if (cols.length > Math.max(dinIdx, nameIdx)) {
          let dosVal = "N/A";
          let fmtVal = "N/A";
          let upcVal = null;

          if (dosageIdx !== -1 && cols[dosageIdx]) {
            dosVal = cols[dosageIdx];
          }
          
          let formatPart = "";
          let unitPart = "";
          if (formatIdx !== -1 && cols[formatIdx] && formatIdx !== dosageIdx) {
            formatPart = cols[formatIdx].trim();
          }
          if (unitIdx !== -1 && cols[unitIdx]) {
            unitPart = cols[unitIdx].trim();
          }

          if (formatPart && unitPart) {
            fmtVal = formatPart + " " + unitPart;
          } else if (formatPart) {
            fmtVal = formatPart;
          } else if (unitPart) {
            fmtVal = unitPart;
          }

          if (upcIdx !== -1 && cols[upcIdx]) {
            upcVal = cols[upcIdx].trim();
          }

          results.push({
            din: cols[dinIdx] || "N/A",
            product: nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : "Inconnu",
            dosage: dosVal,
            format: fmtVal,
            upc: upcVal
          });
        }
      }
      return results;
    }

    async function importCatalogCSV() {
      const fileInput = document.getElementById("catalog-file-input");
      const file = fileInput.files[0];
      if (!file) {
        showToast("Veuillez sélectionner un fichier CSV.", "danger");
        return;
      }
      
      if (!sessionPharmacy) {
        showToast("Veuillez vous connecter d'abord.", "danger");
        return;
      }

      const statusText = document.getElementById("catalog-import-status");
      const progressContainer = document.getElementById("catalog-import-progress-container");
      const progressFill = document.getElementById("catalog-import-progress-fill");

      statusText.style.display = "block";
      statusText.textContent = "Lecture du fichier CSV...";
      progressContainer.style.display = "block";
      progressFill.style.width = "0%";

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const parsedItems = parseCSV(text);

          if (parsedItems.length === 0) {
            throw new Error("Aucune ligne valide trouvée dans le CSV.");
          }

          statusText.textContent = "Nettoyage du catalogue précédent...";
          
          // Effacer l'ancien catalogue de Supabase
          const { error: deleteError } = await supabaseClient
            .from("catalog")
            .delete()
            .eq("pharmacy_id", sessionPharmacy.id);
            
          if (deleteError) throw deleteError;

          statusText.textContent = `Téléversement de ${parsedItems.length} produits vers Supabase...`;
          
          // Insérer par lots de 1000 pour la performance
          const batchSize = 1000;
          let importedCount = 0;
          
          for (let i = 0; i < parsedItems.length; i += batchSize) {
            const chunk = parsedItems.slice(i, i + batchSize).map(item => ({
              pharmacy_id: sessionPharmacy.id,
              din: item.din,
              product: item.product,
              dosage: item.dosage,
              format: item.format
            }));
            
            const { error: insertError } = await supabaseClient
              .from("catalog")
              .insert(chunk);
              
            if (insertError) throw insertError;
            
            importedCount += chunk.length;
            const percent = Math.round((importedCount / parsedItems.length) * 100);
            progressFill.style.width = `${percent}%`;
            statusText.textContent = `Importation Cloud : ${importedCount} / ${parsedItems.length} (${percent}%)`;
          }

          // Recharger en mémoire vive
          await loadSupabaseCatalogToMemory();
          
          statusText.textContent = "Catalogue Cloud importé avec succès !";
          showToast(`Référentiel importé : ${localCatalog.length} articles disponibles.`, "success");
          
          setTimeout(() => {
            statusText.style.display = "none";
            progressContainer.style.display = "none";
          }, 3000);

        } catch (err) {
          statusText.textContent = `Erreur : ${err.message}`;
          showToast(err.message, "danger");
        }
      };

      reader.readAsText(file);
      fileInput.value = ""; // réinitialiser
    }

    async function importUPCAssociationCSV() {
      const fileInput = document.getElementById("upc-file-input");
      const file = fileInput.files[0];
      if (!file) {
        showToast("Veuillez sélectionner un fichier CSV.", "danger");
        return;
      }
      
      if (!sessionPharmacy) {
        showToast("Veuillez vous connecter d'abord.", "danger");
        return;
      }

      const statusText = document.getElementById("upc-import-status");
      const progressContainer = document.getElementById("upc-import-progress-container");
      const progressFill = document.getElementById("upc-import-progress-fill");

      statusText.style.display = "block";
      statusText.textContent = "Lecture du fichier CSV...";
      progressContainer.style.display = "block";
      progressFill.style.width = "0%";

      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const parsedItems = parseCSV(text);

          if (parsedItems.length === 0) {
            throw new Error("Aucune ligne valide trouvée dans le CSV.");
          }

          statusText.textContent = "Association des codes UPC...";
          
          // Filtrer uniquement les lignes qui ont un DIN et un UPC
          const itemsWithUPC = parsedItems.filter(item => item.din && item.din !== "N/A" && item.upc);
          
          if (itemsWithUPC.length === 0) {
            throw new Error("Aucune association DIN et UPC valide trouvée dans le fichier.");
          }

          // Faire les mises à jour par lots
          const batchSize = 50; // Plus petit pour éviter d'inonder Supabase Cloud
          let updatedCount = 0;
          
          for (let i = 0; i < itemsWithUPC.length; i += batchSize) {
            const chunk = itemsWithUPC.slice(i, i + batchSize);
            
            const promises = chunk.map(async (item) => {
              const localMatch = localCatalog.find(lc => lc.din === item.din);
              if (localMatch) {
                const { error } = await supabaseClient
                  .from("catalog")
                  .update({ upc: item.upc })
                  .eq("pharmacy_id", sessionPharmacy.id)
                  .eq("din", item.din);
                
                if (!error) {
                  localMatch.upc = item.upc;
                  return true;
                }
              } else {
                const newCatalogItem = {
                  pharmacy_id: sessionPharmacy.id,
                  din: item.din,
                  product: item.product || "Produit Robot",
                  dosage: item.dosage || "",
                  format: item.format || "",
                  upc: item.upc
                };
                const { error } = await supabaseClient
                  .from("catalog")
                  .insert([newCatalogItem]);
                
                if (!error) {
                  localCatalog.push(newCatalogItem);
                  return true;
                }
              }
              return false;
            });
            
            await Promise.all(promises);
            updatedCount += chunk.length;
            
            const percent = Math.round((updatedCount / itemsWithUPC.length) * 100);
            progressFill.style.width = `${percent}%`;
            statusText.textContent = `Association Cloud : ${updatedCount} / ${itemsWithUPC.length} (${percent}%)`;
          }

          statusText.textContent = `Terminé : ${updatedCount} codes UPC associés !`;
          showToast(`Codes UPC associés avec succès.`, "success");
          renderAllViews();
          
          setTimeout(() => {
            statusText.style.display = "none";
            progressContainer.style.display = "none";
          }, 3000);
        } catch (err) {
          console.error("Erreur import UPC", err);
          statusText.textContent = "Erreur : " + err.message;
          showToast("Erreur d'importation : " + err.message, "danger");
        } finally {
          fileInput.value = "";
        }
      };
      
      reader.readAsText(file);
    }

    async function preloadDefaultCatalog(newPharmacyId) {
      try {
        const { data: refList, error: refError } = await supabaseClient
          .from("catalog")
          .select("pharmacy_id")
          .limit(1);
          
        if (refError) throw refError;
        
        if (!refList || refList.length === 0) {
          console.log("Aucun catalogue de référence existant pour la duplication.");
          return;
        }
        
        const refId = refList[0].pharmacy_id;
        console.log(`Duplication du catalogue depuis : ${refId}`);
        
        let start = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabaseClient
            .from("catalog")
            .select("din, product, dosage, format, upc")
            .eq("pharmacy_id", refId)
            .range(start, start + pageSize - 1);
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            const chunk = data.map(item => ({
              pharmacy_id: newPharmacyId,
              din: item.din,
              product: item.product,
              dosage: item.dosage,
              format: item.format,
              upc: item.upc
            }));
            
            const { error: insertError } = await supabaseClient
              .from("catalog")
              .insert(chunk);
              
            if (insertError) throw insertError;
            
            start += pageSize;
            if (data.length < pageSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }
      } catch (err) {
        console.error("Erreur lors de la duplication du catalogue :", err);
      }
    }

    async function clearCatalogDB() {
      if (!sessionPharmacy) return;
      if (confirm("Voulez-vous supprimer tout le référentiel d'auto-complétion ?")) {
        showLoading("Suppression du catalogue...");
        const { error } = await supabaseClient
          .from("catalog")
          .delete()
          .eq("pharmacy_id", sessionPharmacy.id);
          
        hideLoading();
        if (error) {
          showToast("Erreur lors de la suppression : " + error.message, "danger");
        } else {
          localCatalog = [];
          updateCatalogStatsUI();
          showToast("Catalogue d'auto-complétion effacé.", "success");
        }
      }
    }

    // ----------------------------------------------------
    // RETRAIT MENSUEL - VUE ET ACTIONS (V2 / V3)
    // ----------------------------------------------------
    function renderChecklist() {
      const container = document.getElementById("checklist-container");
      const pastDueContainer = document.getElementById("past-due-alert-container");
      container.innerHTML = "";
      pastDueContainer.innerHTML = "";

      const targetYear = state.targetMonthDate.getFullYear();
      const targetMonthNum = String(state.targetMonthDate.getMonth() + 1).padStart(2, '0');
      const targetMonthKey = `${targetYear}-${targetMonthNum}`;

      // Récupérer les produits cibles (actifs, retirés ou vendus pour ce mois)
      const activeTarget = state.products.filter(p => p.expiryDate === targetMonthKey && p.status === 'active');
      const removedTarget = state.products.filter(p => p.expiryDate === targetMonthKey && p.status === 'removed');
      const soldTarget = state.products.filter(p => p.expiryDate === targetMonthKey && p.status === 'sold');
      const allTarget = [...activeTarget, ...removedTarget, ...soldTarget];

      const pastDueContainer = document.getElementById("past-due-alert-container");
      pastDueContainer.innerHTML = "";

      // Produit(s) d'urgence : expirations du mois cible ou passées non résolues (V3.9.6)
      const urgentProducts = state.products.filter(p => {
        if (p.status !== 'active') return false;
        return p.expiryDate <= targetMonthKey;
      });

      if (urgentProducts.length > 0) {
        const urgentCard = document.createElement("div");
        urgentCard.className = "urgent-alert-card";
        
        let itemsHtml = "";
        urgentProducts.forEach(prod => {
          const isOverdue = prod.expiryDate < targetMonthKey;
          itemsHtml += `
            <div class="urgent-item-row">
              <div style="flex: 1; min-width: 0;">
                <span class="urgent-prod-title">${prod.product}</span>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                  DIN: ${prod.din || 'N/A'} • Section: <strong>${prod.section}</strong> • Qté: ${prod.quantity} • Saisi par: <strong>${prod.techInitials || 'N/A'}</strong>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <span class="urgent-badge ${isOverdue ? 'past-due' : 'imminent'}">
                  ${isOverdue ? 'EN RETARD' : 'CE MOIS-CI'}
                </span>
                <button class="btn btn-danger btn-urgent-remove" data-id="${prod.id}">
                  ✅ Retirer
                </button>
              </div>
            </div>
          `;
        });

        urgentCard.innerHTML = `
          <div class="urgent-alert-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="urgent-pulse-icon">🚨</span>
              <div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: #b91c1c;">Zone d'Urgence : Expirations Imminentes (< 30 jours)</h3>
                <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: #7f1d1d;">${urgentProducts.length} produit(s) nécessitent un retrait immédiat des étagères.</p>
              </div>
            </div>
          </div>
          <div class="urgent-items-list">
            ${itemsHtml}
          </div>
        `;
        pastDueContainer.appendChild(urgentCard);

        // Écouteurs sur boutons de retrait d'urgence
        urgentCard.querySelectorAll(".btn-urgent-remove").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const pId = e.target.getAttribute("data-id");
            const prod = state.products.find(p => p.id === pId);
            handleChecklistAction(pId, 'removed');
            if (prod) showToast(`Produit ${prod.product} retiré d'urgence !`, "success");
          });
        });
      }

      // Calcul des stats
      const totalCount = allTarget.length;
      const resolvedCount = removedTarget.length + soldTarget.length;
      const remainingCount = activeTarget.length;

      document.getElementById("stat-total-target").textContent = totalCount;
      document.getElementById("stat-removed-count").textContent = resolvedCount;
      document.getElementById("stat-remaining-count").textContent = remainingCount;

      if (totalCount === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted);">
            <svg xmlns="http://www.w3.org/2000/svg" style="width: 48px; height: 48px; margin: 0 auto 12px; opacity: 0.5;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style="font-weight: 600;">Aucun produit ciblé pour ${formatMonthYearFrench(state.targetMonthDate)}.</p>
            <p style="font-size: 0.85rem;">Utilisez l'onglet <strong>Saisie / Tournée</strong> pour ajouter des produits.</p>
          </div>
        `;
        return;
      }

      // Grouper par section
      const grouped = {};
      allTarget.forEach(p => {
        if (!grouped[p.section]) grouped[p.section] = [];
        grouped[p.section].push(p);
      });

      const sortedSections = Object.keys(grouped).sort();

      sortedSections.forEach(secName => {
        const secGroup = document.createElement("div");
        secGroup.className = "section-group";

        const secHead = document.createElement("div");
        secHead.className = "section-header";
        const totalInSec = grouped[secName].length;
        const activeInSec = grouped[secName].filter(p => p.status === 'active').length;

        secHead.innerHTML = `
          <span>${secName}</span>
          <span class="section-badge">${totalInSec - activeInSec} / ${totalInSec} résolus</span>
        `;
        secGroup.appendChild(secHead);

        grouped[secName].forEach(prod => {
          const row = document.createElement("div");
          row.className = "product-row";
          
          const isResolved = prod.status !== 'active';
          if (isResolved) {
            row.style.opacity = "0.5";
          }

          const stickerInfo = getStickerInfo(prod.expiryDate);

          row.innerHTML = `
            <div class="product-details">
              <div>
                <span class="prod-title">${prod.product}</span>
                ${prod.notes ? `<div style="font-size: 0.75rem; color: var(--warning-color); font-weight: 500;">Note: ${prod.notes}</div>` : ''}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Saisi par : <strong style="color: var(--text-color);">${prod.techInitials || 'N/A'}</strong></div>
              </div>
              <span class="prod-din">${prod.din || 'N/A'}</span>
              <span class="prod-format">${prod.dosage || 'N/A'}${prod.format && prod.format !== 'N/A' ? ' | ' + prod.format : ''}</span>
              <span class="prod-qty">Qté: ${prod.quantity}</span>
            </div>
            
            <div class="sticker-badge" style="background-color: ${stickerInfo.color}; margin-right: 16px;">
              <span class="sticker-dot"></span>
              <span>${stickerInfo.name}</span>
            </div>

            <!-- CASES À COCHER IMPRESSION (Print Checkboxes V3.9.5) -->
            <div class="print-checkboxes">
              <span class="print-cb-option">
                <span class="cb-box ${prod.status === 'removed' ? 'checked' : ''}">${prod.status === 'removed' ? '✓' : ''}</span>
                <span class="cb-label">Retiré ${prod.status === 'removed' && prod.removedBy ? '(' + prod.removedBy + ')' : ''}</span>
              </span>
              <span class="print-cb-option">
                <span class="cb-box ${prod.status === 'sold' ? 'checked' : ''}">${prod.status === 'sold' ? '✓' : ''}</span>
                <span class="cb-label">Vendu ${prod.status === 'sold' && prod.removedBy ? '(' + prod.removedBy + ')' : ''}</span>
              </span>
            </div>

            <!-- ACTIONS WEB (Retirer vs Vendu) -->
            ${!isResolved ? `
              <div class="checklist-actions">
                <button class="btn-action retirer" data-id="${prod.id}" title="Marquer comme Retiré des tablettes">
                  ✅ Retirer
                </button>
                <button class="btn-action vendu" data-id="${prod.id}" title="Marquer comme Vendu / Épuisé">
                  📦 Vendu
                </button>
              </div>
            ` : `
              <div class="resolution-badge">
                <span class="badge-status ${prod.status === 'removed' ? 'removed' : 'sold'}">
                  ${prod.status === 'removed' ? 'Retiré' : 'Vendu'}
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted);" title="${formatFullDateFrench(new Date(prod.removalDate))}">
                  (${prod.removedBy || 'N/A'})
                </span>
                <button class="btn-undo" data-id="${prod.id}">Annuler</button>
              </div>
            `}
          `;

          // Événements boutons checklist
          if (!isResolved) {
            row.querySelector(".btn-action.retirer").addEventListener("click", () => {
              handleChecklistAction(prod.id, 'removed');
            });
            row.querySelector(".btn-action.vendu").addEventListener("click", () => {
              handleChecklistAction(prod.id, 'sold');
            });
          } else {
            row.querySelector(".btn-undo").addEventListener("click", () => {
              undoChecklistAction(prod.id);
            });
          }

          secGroup.appendChild(row);
        });

        container.appendChild(secGroup);
      });
    }

    function handleChecklistAction(id, actionType) {
      if (state.sessionInitials.trim() !== "") {
        // Enregistrer directement
        performCheckout(id, actionType, state.sessionInitials);
      } else {
        // Demander initiales
        openCheckoutModal(id, actionType);
      }
    }

    function undoChecklistAction(id) {
      const prod = state.products.find(p => p.id === id);
      if (prod) {
        prod.status = 'active';
        prod.removalDate = null;
        prod.removedBy = null;
        saveProducts();
        showToast(`"${prod.product}" remis sur les tablettes.`, "success");
        renderAllViews();
      }
    }

    function openCheckoutModal(productId, actionType) {
      pendingCheckout.productId = productId;
      pendingCheckout.actionType = actionType;
      
      const prod = state.products.find(p => p.id === productId);
      if (prod) {
        const actionLabel = actionType === 'removed' ? 'RETRAIT' : 'VENTE/ABSENCE';
        document.getElementById("checkout-modal-title").textContent = `Confirmer l'action : ${actionLabel}`;
        document.getElementById("checkout-product-info").textContent = `${prod.product} (Section: ${prod.section}, Qté: ${prod.quantity})`;
        
        const modal = document.getElementById("checkout-modal-overlay");
        modal.classList.add("active");
        
        const initInput = document.getElementById("checkout-initials");
        initInput.value = state.sessionInitials;
        setTimeout(() => initInput.focus(), 100);
      }
    }

    function closeCheckoutModal() {
      document.getElementById("checkout-modal-overlay").classList.remove("active");
      pendingCheckout.productId = null;
      pendingCheckout.actionType = null;
    }

    function confirmCheckout() {
      const input = document.getElementById("checkout-initials");
      const initials = input.value.toUpperCase().trim();
      
      if (initials === "") {
        input.focus();
        return;
      }

      // Option mémoriser session
      const saveSession = document.getElementById("checkout-save-session").checked;
      if (saveSession) {
        state.sessionInitials = initials;
        localStorage.setItem("exp_tech_initials", initials);
        document.getElementById("session-initials").value = initials;
        document.getElementById("form-tech").value = initials;
      }

      performCheckout(pendingCheckout.productId, pendingCheckout.actionType, initials);
      closeCheckoutModal();
    }

    function performCheckout(id, actionType, initials) {
      const prod = state.products.find(p => p.id === id);
      if (prod) {
        prod.status = actionType; // 'removed' ou 'sold'
        prod.removalDate = new Date().toISOString();
        prod.removedBy = initials;
        saveProducts();
        
        const actionName = actionType === 'removed' ? 'retiré des tablettes' : 'marqué comme vendu';
        showToast(`"${prod.product}" ${actionName} par ${initials}.`, "success");
        renderAllViews();
      }
    }

    // ----------------------------------------------------
    // TOURNEE - ASSISTANT FLEXIBLE & SAISIE (V3)
    // ----------------------------------------------------
    function updateFormStickerPreview(expiryVal) {
      const previewBox = document.getElementById("form-sticker-preview");
      if (!expiryVal) {
        previewBox.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Saisissez une date d\'expiration pour voir la pastille correspondante.</p>';
        return;
      }

      const stickerInfo = getStickerInfo(expiryVal);
      const [year, month] = expiryVal.split('-');
      const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      previewBox.innerHTML = `
        <div class="sticker-circle" style="background-color: ${stickerInfo.color};">
          ${getMonthAbbreviation(dateObj.getMonth())}
        </div>
        <p style="font-weight: 700; font-size: 1.1rem; color: var(--text-color);">${stickerInfo.name}</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Posez ce collant sur la boîte du produit (${formatMonthNameFrench(dateObj.getMonth())} ${year}).</p>
      `;
    }

    function updateTourneeAssistant() {
      // Période ciblée flexible
      const startMonthStr = state.tourneeStartMonth; // format YYYY-MM
      const duration = state.tourneeDuration;

      const [startYear, startMonthZeroIdx] = startMonthStr.split('-').map(Number);
      const startDate = new Date(startYear, startMonthZeroIdx - 1, 1);

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + duration - 1);

      document.getElementById("tournee-target-period").textContent = `${formatMonthYearFrench(startDate)} à ${formatMonthYearFrench(endDate)}`;

      // Lister les collants à préparer
      const listDiv = document.getElementById("tournee-stickers-list");
      listDiv.innerHTML = "";

      for (let i = 0; i < duration; i++) {
        const loopDate = new Date(startDate);
        loopDate.setMonth(loopDate.getMonth() + i);
        
        const monthNum = String(loopDate.getMonth() + 1).padStart(2, '0');
        const stickerInfo = state.config.stickerColors[monthNum];

        if (stickerInfo) {
          const item = document.createElement("div");
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.gap = "10px";
          item.style.padding = "8px";
          item.style.borderRadius = "8px";
          item.style.backgroundColor = "var(--card-bg)";
          item.style.border = "1px solid var(--border-color)";

          item.innerHTML = `
            <div class="sticker-circle" style="width: 28px; height: 28px; font-size: 0.7rem; margin-bottom: 0; background-color: ${stickerInfo.color}; border: 1px solid #fff;">
              ${getMonthAbbreviation(loopDate.getMonth())}
            </div>
            <div>
              <p style="font-size: 0.85rem; font-weight: 600;">${formatMonthNameFrench(loopDate.getMonth())}</p>
              <p style="font-size: 0.75rem; color: var(--text-muted);">${stickerInfo.name}</p>
            </div>
          `;
          listDiv.appendChild(item);
        }
      }
      updateSectionsProgressUI();
    }

    function updateSectionsProgressUI() {
      const progressListTournee = document.getElementById("tournee-sections-progress-list");
      const progressListRetrait = document.getElementById("retrait-sections-progress-list");
      if (!progressListTournee && !progressListRetrait) return;
      
      const sections = state.config.sections || [];
      const tourKey = `${state.tourneeStartMonth}_${state.tourneeDuration}`;
      
      if (!state.sectionsProgress) {
        state.sectionsProgress = {};
      }
      if (!state.sectionsProgress[tourKey]) {
        state.sectionsProgress[tourKey] = {};
      }
      
      // Calculer la période ciblée
      const [startYear, startMonthZeroIdx] = state.tourneeStartMonth.split('-').map(Number);
      const startDate = new Date(startYear, startMonthZeroIdx - 1, 1);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + state.tourneeDuration - 1);
      
      const startKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Compter les produits actifs saisis dans chaque section pendant cette tournée
      const sectionCounts = {};
      sections.forEach(s => sectionCounts[s] = 0);
      
      (state.products || []).forEach(p => {
        if (p.status === 'active' && p.expiryDate >= startKey && p.expiryDate <= endKey) {
          if (sectionCounts[p.section] !== undefined) {
            sectionCounts[p.section]++;
          }
        }
      });
      
      let completedCount = 0;
      if (progressListTournee) progressListTournee.innerHTML = "";
      if (progressListRetrait) progressListRetrait.innerHTML = "";
      
      sections.forEach(secName => {
        let status = state.sectionsProgress[tourKey][secName];
        const count = sectionCounts[secName] || 0;
        
        if (status === 'completed') {
          completedCount++;
        } else if (count > 0) {
          status = 'in_progress';
        } else {
          status = 'not_started';
        }
        
        let dotColor = "";
        if (status === 'completed') {
          dotColor = "#10b981"; // success / green
        } else if (status === 'in_progress') {
          dotColor = "#f59e0b"; // warning / amber
        } else {
          dotColor = "#ef4444"; // danger / red
        }
        
        const isChecked = status === 'completed' ? 'checked' : '';

        const makeItem = () => {
          const item = document.createElement("div");
          item.className = "section-progress-item";
          item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
              <span class="status-dot-glow" style="color: ${dotColor}; background-color: ${dotColor};"></span>
              <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-color);" title="${secName}">${secName}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 2px;">(${count})</span>
            </div>
            <label style="display: flex; align-items: center; cursor: pointer; margin-bottom: 0;">
              <input type="checkbox" ${isChecked} style="width: 16px; height: 16px; accent-color: var(--primary-color);" class="sec-progress-cb">
            </label>
          `;
          
          item.querySelector(".sec-progress-cb").addEventListener("change", async (e) => {
            if (e.target.checked) {
              state.sectionsProgress[tourKey][secName] = 'completed';
            } else {
              delete state.sectionsProgress[tourKey][secName];
            }
            updateSectionsProgressUI();
            await saveConfig();
          });
          return item;
        };

        if (progressListTournee) progressListTournee.appendChild(makeItem());
        if (progressListRetrait) progressListRetrait.appendChild(makeItem());
      });
      
      // Mettre à jour les barres et pourcentages de progression
      const totalSections = sections.length || 1;
      const percent = Math.round((completedCount / totalSections) * 100);
      
      const tourneePercent = document.getElementById("tournee-progress-percent");
      const tourneeBar = document.getElementById("tournee-progress-bar");
      if (tourneePercent) tourneePercent.textContent = `${percent}%`;
      if (tourneeBar) tourneeBar.style.width = `${percent}%`;

      const retraitPercent = document.getElementById("retrait-progress-percent");
      const retraitBar = document.getElementById("retrait-progress-bar");
      if (retraitPercent) retraitPercent.textContent = `${percent}%`;
      if (retraitBar) retraitBar.style.width = `${percent}%`;
    }

    function addNewProduct() {
      const section = document.getElementById("form-section").value;
      const din = document.getElementById("form-din").value.trim() || "N/A";
      const name = document.getElementById("form-product").value.trim();
      const dosage = document.getElementById("form-dosage").value.trim() || "N/A";
      const format = document.getElementById("form-format").value.trim() || "N/A";
      const qty = document.getElementById("form-qty").value;
      const expiry = document.getElementById("form-expiry").value; // YYYY-MM
      const tech = document.getElementById("form-tech").value.toUpperCase().trim();
      const notes = document.getElementById("form-notes").value.trim();

      // Validation alerte de période de tournée
      const [expYear, expMonth] = expiry.split('-').map(Number);
      const expDate = new Date(expYear, expMonth - 1, 1);

      const [startYear, startMonthZeroIdx] = state.tourneeStartMonth.split('-').map(Number);
      const tourStart = new Date(startYear, startMonthZeroIdx - 1, 1);
      
      const tourEnd = new Date(tourStart);
      tourEnd.setMonth(tourEnd.getMonth() + state.tourneeDuration); // fin de période exclue

      if (expDate < tourStart || expDate >= tourEnd) {
        showToast("Attention : Ce produit expire en dehors de la tournée configurée !", "danger");
      }

      const newProd = {
        id: "prod-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
        section: section,
        din: din,
        product: name,
        dosage: dosage,
        format: format,
        quantity: qty,
        expiryDate: expiry,
        status: "active",
        dateAdded: new Date().toISOString(),
        techInitials: tech,
        removalDate: null,
        removedBy: null,
        notes: notes
      };

      state.products.push(newProd);
      saveProducts();

      // Auto-apprentissage : Enregistrer l'association UPC <-> DIN
      if (tempScannedUPC && din !== "N/A" && name) {
        saveUPCAssociation(tempScannedUPC, din, name, dosage, format);
      }
      tempScannedUPC = "";
      const helperText = document.getElementById("scan-helper-text");
      if (helperText) helperText.style.display = "none";

      // Mémoriser session initials
      state.sessionInitials = tech;
      localStorage.setItem("exp_tech_initials", tech);
      document.getElementById("session-initials").value = tech;

      showToast(`"${name}" enregistré.`, "success");

      // Réinitialiser les champs (sauf section, tech initials et date d'exp par défaut)
      document.getElementById("form-product").value = "";
      document.getElementById("form-din").value = "";
      document.getElementById("form-dosage").value = "";
      document.getElementById("form-format").value = "";
      document.getElementById("form-qty").value = "1";
      document.getElementById("form-notes").value = "";

      // Garder le focus sur le DIN pour le prochain scan
      document.getElementById("form-din").focus();

      // Rendre les vues
      populateSectionDropdowns();
      renderAllViews();
    }

    function renderRecentEntries() {
      const tbody = document.getElementById("recent-entries-body");
      tbody.innerHTML = "";

      const sorted = [...state.products]
        .sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));

      const totalCount = sorted.length;
      const recent = showAllRecent ? sorted : sorted.slice(0, 20);

      const toggleContainer = document.getElementById("recent-toggle-container");
      const toggleBtn = document.getElementById("btn-toggle-recent-entries");

      if (totalCount > 20) {
        toggleContainer.style.display = "block";
        toggleBtn.textContent = showAllRecent ? "Réduire la liste (voir 20)" : `Voir la liste complète (${totalCount} produits)`;
      } else {
        toggleContainer.style.display = "none";
      }

      if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Aucun produit.</td></tr>`;
        return;
      }

      recent.forEach(prod => {
        const [year, month] = prod.expiryDate.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const stickerInfo = getStickerInfo(prod.expiryDate);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight: 600;">${prod.section}</td>
          <td>
            <span style="font-weight: 600; color: var(--text-color);">${prod.product}</span>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
              DIN: ${prod.din || 'N/A'} | Dos: ${prod.dosage || 'N/A'} | Fmt: ${prod.format || 'N/A'} | Saisi par: <strong>${prod.techInitials || 'N/A'}</strong>
            </div>
          </td>
          <td>${formatMonthYearFrench(dateObj)}</td>
          <td>
            <div class="sticker-badge" style="background-color: ${stickerInfo.color}; font-size: 0.7rem; padding: 2px 6px;">
              <span class="sticker-dot" style="width: 6px; height: 6px;"></span>
              <span>${stickerInfo.name}</span>
            </div>
          </td>
          <td style="font-weight: 700;">${prod.quantity}</td>
          <td>
            <div class="action-btn-group">
              <button class="btn-icon" title="Modifier" onclick="openEditModal('${prod.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-2.036a5 5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button class="btn-icon danger" title="Supprimer" onclick="deleteProduct('${prod.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // ----------------------------------------------------
    // INVENTAIRE COMPLET - VUE ET TRIS
    // ----------------------------------------------------
    function triggerSort(key) {
      if (state.sorting.key === key) {
        state.sorting.direction = state.sorting.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.sorting.key = key;
        state.sorting.direction = 'asc';
      }
      renderInventoryTable();
    }

    function renderInventoryTable() {
      const tbody = document.getElementById("inventory-table-body");
      tbody.innerHTML = "";

      const sourceRadio = document.querySelector('input[name="inventory-source"]:checked');
      const source = sourceRadio ? sourceRadio.value : "flagged";
      const isCatalog = (source === "catalog");

      // Afficher/Masquer les filtres selon la source
      document.getElementById("filter-section-group").style.display = isCatalog ? "none" : "block";
      document.getElementById("filter-month-group").style.display = isCatalog ? "none" : "block";
      document.getElementById("filter-status-group").style.display = isCatalog ? "none" : "block";

      const filterBar = document.getElementById("inventory-filter-bar");
      if (isCatalog) {
        filterBar.style.gridTemplateColumns = "1fr";
      } else {
        filterBar.style.gridTemplateColumns = "repeat(auto-fit, minmax(200px, 1fr))";
      }

      // Mise à jour dynamique du titre et des en-têtes de colonnes
      const headerRow = document.getElementById("inventory-table-header-row");
      if (isCatalog) {
        document.getElementById("inventory-card-title").textContent = "Catalogue de référence complet";
        headerRow.innerHTML = `
          <th onclick="triggerSort('din')" style="cursor: pointer; user-select: none;">DIN ${getSortIcon('din')}</th>
          <th onclick="triggerSort('product')" style="cursor: pointer; user-select: none;">Produit ${getSortIcon('product')}</th>
          <th onclick="triggerSort('dosage')" style="cursor: pointer; user-select: none;">Dosage ${getSortIcon('dosage')}</th>
          <th onclick="triggerSort('format')" style="cursor: pointer; user-select: none;">Format/Un. ${getSortIcon('format')}</th>
          <th>Action</th>
        `;
      } else {
        document.getElementById("inventory-card-title").textContent = "Inventaire des produits flaggés";
        headerRow.innerHTML = `
          <th onclick="triggerSort('status')" style="cursor: pointer; user-select: none;">Statut ${getSortIcon('status')}</th>
          <th onclick="triggerSort('expiryDate')" style="cursor: pointer; user-select: none;">Pastille ${getSortIcon('expiryDate')}</th>
          <th onclick="triggerSort('product')" style="cursor: pointer; user-select: none;">Produit ${getSortIcon('product')}</th>
          <th onclick="triggerSort('din')" style="cursor: pointer; user-select: none;">DIN ${getSortIcon('din')}</th>
          <th onclick="triggerSort('dosage')" style="cursor: pointer; user-select: none;">Dosage ${getSortIcon('dosage')}</th>
          <th onclick="triggerSort('format')" style="cursor: pointer; user-select: none;">Format/Un. ${getSortIcon('format')}</th>
          <th onclick="triggerSort('quantity')" style="cursor: pointer; user-select: none;">Qté ${getSortIcon('quantity')}</th>
          <th onclick="triggerSort('expiryDate')" style="cursor: pointer; user-select: none;">Expiration ${getSortIcon('expiryDate')}</th>
          <th onclick="triggerSort('section')" style="cursor: pointer; user-select: none;">Section ${getSortIcon('section')}</th>
          <th>Actions</th>
        `;
      }

      const searchQuery = document.getElementById("filter-search").value.toLowerCase().trim();

      if (isCatalog) {
        // Mode catalogue de référence
        let filtered = [];
        if (searchQuery === "") {
          filtered = localCatalog.slice(0, 100);
        } else {
          filtered = localCatalog.filter(item => {
            return (item.product && item.product.toLowerCase().includes(searchQuery)) ||
                   (item.din && item.din.toLowerCase().includes(searchQuery)) ||
                   (item.upc && item.upc.toLowerCase().includes(searchQuery)) ||
                   (item.dosage && item.dosage.toLowerCase().includes(searchQuery)) ||
                   (item.format && item.format.toLowerCase().includes(searchQuery));
          });
        }

        // Tri
        filtered.sort((a, b) => {
          let valA = a[state.sorting.key] || '';
          let valB = b[state.sorting.key] || '';
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();

          if (valA < valB) return state.sorting.direction === 'asc' ? -1 : 1;
          if (valA > valB) return state.sorting.direction === 'asc' ? 1 : -1;
          return 0;
        });

        const totalMatches = filtered.length;
        const displayList = filtered.slice(0, 100);

        if (displayList.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Aucun produit trouvé dans le catalogue.</td></tr>`;
          return;
        }

        displayList.forEach(item => {
          const tr = document.createElement("tr");
          
          const escapedDin = (item.din || 'N/A').replace(/'/g, "\\'");
          const escapedProduct = (item.product || 'Inconnu').replace(/'/g, "\\'");
          const escapedDosage = (item.dosage || 'N/A').replace(/'/g, "\\'");
          const escapedFormat = (item.format || 'N/A').replace(/'/g, "\\'");

          tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem;">${item.din || 'N/A'}</td>
            <td><span class="prod-title">${item.product}</span></td>
            <td style="color: var(--text-muted);">${item.dosage || 'N/A'}</td>
            <td style="color: var(--text-muted);">${item.format || 'N/A'}</td>
            <td>
              <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;" onclick="loadProductToSaisie('${escapedDin}', '${escapedProduct}', '${escapedDosage}', '${escapedFormat}')">
                ➕ Signaler
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        if (totalMatches > 100) {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td colspan="5" style="text-align: center; font-size: 0.8rem; color: var(--text-muted); background-color: var(--bg-color); padding: 8px;">
              Affichage des 100 premiers résultats sur ${totalMatches}. Veuillez affiner votre recherche si nécessaire.
            </td>
          `;
          tbody.appendChild(tr);
        }

      } else {
        // Mode produits flaggés expirés
        const sectionFilter = document.getElementById("filter-section").value;
        const monthFilter = document.getElementById("filter-month").value;
        const statusFilter = document.getElementById("filter-status").value;

        let filtered = state.products.filter(p => {
          const matchSearch = searchQuery === "" || 
            (p.product && p.product.toLowerCase().includes(searchQuery)) ||
            (p.din && p.din.toLowerCase().includes(searchQuery)) ||
            (p.upc && p.upc.toLowerCase().includes(searchQuery)) ||
            (p.notes && p.notes.toLowerCase().includes(searchQuery)) ||
            (p.section && p.section.toLowerCase().includes(searchQuery));

          const matchSection = sectionFilter === "ALL" || p.section === sectionFilter;
          const matchMonth = monthFilter === "ALL" || p.expiryDate === monthFilter;

          let matchStatus = true;
          if (statusFilter === "ACTIVE") matchStatus = p.status === 'active';
          else if (statusFilter === "RESOLVED") matchStatus = p.status !== 'active';
          else if (statusFilter === "REMOVED") matchStatus = p.status === 'removed';
          else if (statusFilter === "SOLD") matchStatus = p.status === 'sold';

          return matchSearch && matchSection && matchMonth && matchStatus;
        });

        // Tri
        filtered.sort((a, b) => {
          let valA = a[state.sorting.key];
          let valB = b[state.sorting.key];

          if (state.sorting.key === 'quantity') {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
          } else {
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
          }

          if (valA < valB) return state.sorting.direction === 'asc' ? -1 : 1;
          if (valA > valB) return state.sorting.direction === 'asc' ? 1 : -1;
          return 0;
        });

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">Aucun produit trouvé.</td></tr>`;
          return;
        }

        filtered.forEach(prod => {
          const [year, month] = prod.expiryDate.split('-');
          const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
          const stickerInfo = getStickerInfo(prod.expiryDate);

          const tr = document.createElement("tr");
          if (prod.status !== 'active') tr.className = "removed-row";

          let statusText = "Sur tablette";
          if (prod.status === 'removed') statusText = "Retiré";
          if (prod.status === 'sold') statusText = "Vendu / Absent";

          tr.innerHTML = `
            <td>
              <span class="badge-status ${prod.status}">
                ${statusText}
              </span>
            </td>
            <td>
              <div class="sticker-badge" style="background-color: ${stickerInfo.color};">
                <span class="sticker-dot"></span>
                <span>${stickerInfo.name}</span>
              </div>
            </td>
            <td>
              <span class="prod-title">${prod.product}</span>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                Saisi par : <strong>${prod.techInitials || 'N/A'}</strong> ${prod.status !== 'active' && prod.removedBy ? '| Retiré par : <strong>' + prod.removedBy + '</strong>' : ''}
              </div>
              ${prod.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Note: ${prod.notes}</div>` : ''}
            </td>
            <td style="font-family: monospace; font-size: 0.85rem;">${prod.din || 'N/A'}</td>
            <td style="color: var(--text-muted);">${prod.dosage || 'N/A'}</td>
            <td style="color: var(--text-muted);">${prod.format || 'N/A'}</td>
            <td style="font-weight: 700; font-size: 1rem;">${prod.quantity}</td>
            <td style="font-weight: 600;">${formatMonthYearFrench(dateObj)}</td>
            <td style="font-weight: 600; color: var(--primary-color);">${prod.section}</td>
            <td>
              <div class="action-btn-group">
                <button class="btn-icon" title="Modifier" onclick="openEditModal('${prod.id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-2.036a5 5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button class="btn-icon danger" title="Supprimer" onclick="deleteProduct('${prod.id}')">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    function openEditModal(productId) {
      const prod = state.products.find(p => p.id === productId);
      if (!prod) return;

      document.getElementById("edit-prod-id").value = prod.id;
      document.getElementById("edit-prod-name").value = prod.product;
      document.getElementById("edit-prod-din").value = prod.din;
      document.getElementById("edit-prod-dosage").value = (prod.dosage === "N/A") ? "" : prod.dosage;
      document.getElementById("edit-prod-format").value = (prod.format === "N/A") ? "" : prod.format;
      document.getElementById("edit-prod-qty").value = prod.quantity;
      document.getElementById("edit-prod-expiry").value = prod.expiryDate;
      document.getElementById("edit-prod-status").value = prod.status;
      document.getElementById("edit-prod-notes").value = prod.notes || "";

      // Sections
      const editSel = document.getElementById("edit-prod-section");
      editSel.innerHTML = "";
      
      const dropdownSections = new Set(state.config.sections);
      if (prod.section) {
        dropdownSections.add(prod.section);
      }
      
      Array.from(dropdownSections).sort().forEach(sec => {
        const opt = document.createElement("option");
        opt.value = sec;
        opt.textContent = sec;
        editSel.appendChild(opt);
      });
      editSel.value = prod.section;

      // Infos de retrait/vente
      const infoGroup = document.getElementById("edit-removal-info-group");
      if (prod.status !== 'active') {
        infoGroup.style.display = "block";
        document.getElementById("edit-removal-date").textContent = formatFullDateFrench(new Date(prod.removalDate));
        document.getElementById("edit-removal-by").textContent = prod.removedBy || "N/A";
      } else {
        infoGroup.style.display = "none";
      }

      document.getElementById("edit-modal-overlay").classList.add("active");
    }

    function closeEditModal() {
      document.getElementById("edit-modal-overlay").classList.remove("active");
    }

    function saveProductEdits() {
      const id = document.getElementById("edit-prod-id").value;
      const name = document.getElementById("edit-prod-name").value.trim();
      const section = document.getElementById("edit-prod-section").value;
      const din = document.getElementById("edit-prod-din").value.trim() || "N/A";
      const dosage = document.getElementById("edit-prod-dosage").value.trim() || "N/A";
      const format = document.getElementById("edit-prod-format").value.trim() || "N/A";
      const qty = document.getElementById("edit-prod-qty").value;
      const expiry = document.getElementById("edit-prod-expiry").value;
      const status = document.getElementById("edit-prod-status").value;
      const notes = document.getElementById("edit-prod-notes").value.trim();

      if (!name || !expiry) return;

      const idx = state.products.findIndex(p => p.id === id);
      if (idx !== -1) {
        const p = state.products[idx];
        p.product = name;
        p.section = section;
        p.din = din;
        p.dosage = dosage;
        p.format = format;
        p.quantity = qty;
        p.expiryDate = expiry;
        p.notes = notes;

        if (p.status !== status) {
          p.status = status;
          if (status !== 'active') {
            p.removalDate = new Date().toISOString();
            p.removedBy = state.sessionInitials || "EDITEUR";
          } else {
            p.removalDate = null;
            p.removedBy = null;
          }
        }

        saveProducts();
        showToast("Produit modifié.", "success");
        closeEditModal();
        populateSectionDropdowns();
        renderAllViews();
      }
    }

    function deleteProduct(productId) {
      const prod = state.products.find(p => p.id === productId);
      if (!prod) return;

      if (confirm(`Supprimer définitivement "${prod.product}" ?`)) {
        state.products = state.products.filter(p => p.id !== productId);
        saveProducts();
        showToast("Produit supprimé.", "success");
        populateSectionDropdowns();
        renderAllViews();
      }
    }

    // ----------------------------------------------------
    // INTERFACE DE CONFIGURATION (PARAMÈTRES)
    // ----------------------------------------------------
    function renderConfigPanel() {
      // Liste de sections
      const listDiv = document.getElementById("config-sections-list");
      listDiv.innerHTML = "";
      
      state.config.sections.forEach(sec => {
        const div = document.createElement("div");
        div.className = "section-editor-item";
        
        // Échapper les guillemets simples pour éviter les erreurs d'attributs HTML/JS
        const escapedSec = sec.replace(/'/g, "\\'");
        
        div.innerHTML = `
          <strong>${sec}</strong>
          <div style="display: flex; gap: 8px;">
            <button class="btn-icon" title="Renommer la section" onclick="renameSection('${escapedSec}')">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-2.036a5 5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
            <button class="btn-icon danger" title="Supprimer la section" onclick="deleteSection('${escapedSec}')">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        `;
        listDiv.appendChild(div);
      });

      // Grille de couleurs pastilles
      const grid = document.getElementById("config-colors-grid");
      grid.innerHTML = "";

      for (let i = 1; i <= 12; i++) {
        const mKey = String(i).padStart(2, '0');
        const colorInfo = state.config.stickerColors[mKey];
        const monthName = formatMonthNameFrench(i - 1);

        const card = document.createElement("div");
        card.className = "color-picker-item";
        card.innerHTML = `
          <span>${monthName}</span>
          <div class="color-picker-wrapper">
            <input type="color" value="${colorInfo.color}" id="col-pick-${mKey}">
            <input type="text" value="${colorInfo.name}" id="col-name-${mKey}">
          </div>
        `;

        card.querySelector(`#col-pick-${mKey}`).addEventListener("change", (e) => {
          state.config.stickerColors[mKey].color = e.target.value;
          saveConfig();
          updateDateDisplays();
          updateTourneeAssistant();
          renderAllViews();
        });

        card.querySelector(`#col-name-${mKey}`).addEventListener("change", (e) => {
          state.config.stickerColors[mKey].name = e.target.value.trim() || "Inconnue";
          saveConfig();
          updateDateDisplays();
          updateTourneeAssistant();
          renderAllViews();
        });

        grid.appendChild(card);
      }

      // Configurer boutons de cycle par défaut
      document.querySelectorAll("input[name='tournee-cycle-default']").forEach(radio => {
        if (parseInt(radio.value) === state.config.expiryWindowMonths) {
          radio.checked = true;
        }
      });

      // Remplir le lien d'invitation (V3.7)
      const inviteInput = document.getElementById("config-invite-link");
      if (inviteInput && sessionPharmacy) {
        const origin = window.location.origin === "null" || !window.location.origin ? "file://" : window.location.origin;
        const path = window.location.pathname;
        const link = `${origin}${path}?invite=${sessionPharmacy.id}&name=${encodeURIComponent(sessionPharmacy.name)}`;
        inviteInput.value = link;
      }
    }

    function deleteSection(sectionName) {
      const count = state.products.filter(p => p.section === sectionName).length;
      let msg = `Supprimer la section "${sectionName}" ?`;
      if (count > 0) {
        msg = `Attention : ${count} produit(s) utilisent la section "${sectionName}". Elle y restera appliquée mais vous ne pourrez plus la sélectionner pour de nouvelles saisies. Continuer ?`;
      }
      if (confirm(msg)) {
        state.config.sections = state.config.sections.filter(s => s !== sectionName);
        if (state.sectionsProgress) {
          for (const tourKey in state.sectionsProgress) {
            delete state.sectionsProgress[tourKey][sectionName];
          }
        }
        saveConfig();
        populateSectionDropdowns();
        renderConfigPanel();
        showToast("Section supprimée.", "success");
      }
    }

    function renameSection(oldName) {
      const newName = prompt(`Renommer la section "${oldName}" en :`, oldName);
      if (newName === null) return;

      const formattedName = newName.toUpperCase().trim();
      if (formattedName === "") {
        showToast("Le nom de section ne peut pas être vide.", "danger");
        return;
      }

      if (formattedName === oldName) return;

      if (state.config.sections.includes(formattedName)) {
        showToast(`La section "${formattedName}" existe déjà.`, "danger");
        return;
      }

      // Modifier dans la configuration
      const idx = state.config.sections.indexOf(oldName);
      if (idx !== -1) {
        state.config.sections[idx] = formattedName;
        state.config.sections.sort();
        if (state.sectionsProgress) {
          for (const tourKey in state.sectionsProgress) {
            if (state.sectionsProgress[tourKey][oldName]) {
              state.sectionsProgress[tourKey][formattedName] = state.sectionsProgress[tourKey][oldName];
              delete state.sectionsProgress[tourKey][oldName];
            }
          }
        }
      }

      // Mettre à jour tous les produits concernés
      let count = 0;
      state.products.forEach(p => {
        if (p.section === oldName) {
          p.section = formattedName;
          count++;
        }
      });

      saveConfig();
      saveProducts();
      
      populateSectionDropdowns();
      renderConfigPanel();
      renderAllViews();

      if (count > 0) {
        showToast(`Section renommée. ${count} produit(s) mis à jour !`, "success");
      } else {
        showToast("Section renommée.", "success");
      }
    }

    function populateSectionDropdowns() {
      const sections = state.config.sections;
      const formSel = document.getElementById("form-section");
      const editSel = document.getElementById("edit-prod-section");
      const filterSel = document.getElementById("filter-section");

      // Sauvegarder les sélections actuelles pour éviter les réinitialisations intempestives
      const prevFormVal = formSel ? formSel.value : "";
      const prevEditVal = editSel ? editSel.value : "";
      const prevFilterVal = filterSel ? filterSel.value : "";

      if (formSel) {
        formSel.innerHTML = "";
        sections.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          formSel.appendChild(opt);
        });
      }

      if (editSel) {
        editSel.innerHTML = "";
        sections.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          editSel.appendChild(opt);
        });
      }

      if (filterSel) {
        filterSel.innerHTML = '<option value="ALL">Toutes les sections</option>';
        
        // Combiner les sections configurées et les sections présentes sur les produits
        const allFilterSections = new Set(sections);
        state.products.forEach(p => {
          if (p.section) {
            allFilterSections.add(p.section);
          }
        });
        
        Array.from(allFilterSections).sort().forEach(s => {
          const opt = document.createElement("option");
          opt.value = s;
          opt.textContent = s;
          filterSel.appendChild(opt);
        });
      }

      // Restaurer les sélections
      if (formSel) {
        if (prevFormVal && sections.includes(prevFormVal)) {
          formSel.value = prevFormVal;
        } else if (sections.length > 0) {
          formSel.value = sections[0];
        }
      }

      if (editSel && prevEditVal && sections.includes(prevEditVal)) {
        editSel.value = prevEditVal;
      }

      if (filterSel) {
        filterSel.value = prevFilterVal || "ALL";
      }

      // Filtre de mois
      const filterMonth = document.getElementById("filter-month");
      const months = [...new Set(state.products.map(p => p.expiryDate))].sort();
      filterMonth.innerHTML = '<option value="ALL">Tous les mois</option>';
      
      months.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        const [y, mon] = m.split('-');
        if (y && mon) {
          const dateObj = new Date(parseInt(y), parseInt(mon) - 1, 1);
          opt.textContent = formatMonthYearFrench(dateObj);
        } else {
          opt.textContent = m;
        }
        filterMonth.appendChild(opt);
      });
    }

    // ----------------------------------------------------
    // IMPORTS & EXPORTS DE FICHIERS SAUVEGARDES
    // ----------------------------------------------------
    function exportBackupJSON() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `expires_database_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Sauvegarde exportée.", "success");
    }

    function importBackupJSON(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported.products && imported.config) {
            tempImportedData = imported;
            // Mettre à jour les informations du modal et l'afficher
            document.getElementById("import-count-products").textContent = imported.products.length;
            document.getElementById("import-modal-overlay").classList.add("active");
          } else {
            showToast("Format de fichier non valide.", "danger");
          }
        } catch (err) {
          showToast("Erreur de lecture : " + err.message, "danger");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    }

    function closeImportModal() {
      document.getElementById("import-modal-overlay").classList.remove("active");
      tempImportedData = null;
    }

    async function confirmReplaceImport() {
      if (!tempImportedData) return;
      
      state.products = tempImportedData.products;
      state.config = tempImportedData.config;
      if (tempImportedData.sessionInitials) {
        state.sessionInitials = tempImportedData.sessionInitials;
        document.getElementById("session-initials").value = state.sessionInitials;
        document.getElementById("form-tech").value = state.sessionInitials;
      }
      
      showLoading("Importation et sauvegarde Cloud...");
      try {
        await saveProducts();
        await saveConfig();
        await loadDataFromSupabase();
        showToast("Données remplacées avec succès.", "success");
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de l'importation : " + err.message, "danger");
      } finally {
        hideLoading();
        closeImportModal();
      }
    }

    async function confirmMergeImport() {
      if (!tempImportedData) return;

      // 1. Fusionner les produits (par ID pour écraser si déjà présent, sinon ajouter)
      const existingProductMap = new Map();
      state.products.forEach(p => existingProductMap.set(p.id, p));

      tempImportedData.products.forEach(importedProd => {
        // Remplacer ou ajouter le produit
        existingProductMap.set(importedProd.id, importedProd);
      });

      state.products = Array.from(existingProductMap.values());

      // 2. Fusionner les sections (sans doublons, triées)
      const mergedSections = new Set(state.config.sections);
      if (tempImportedData.config.sections && Array.isArray(tempImportedData.config.sections)) {
        tempImportedData.config.sections.forEach(sec => mergedSections.add(sec));
      }
      state.config.sections = Array.from(mergedSections).sort();

      // 3. Fusionner les stickers de couleur
      if (tempImportedData.config.stickerColors && typeof tempImportedData.config.stickerColors === 'object') {
        for (const monthKey in tempImportedData.config.stickerColors) {
          state.config.stickerColors[monthKey] = tempImportedData.config.stickerColors[monthKey];
        }
      }

      // 4. Fusionner la durée par défaut si existante
      if (tempImportedData.config.expiryWindowMonths) {
        state.config.expiryWindowMonths = tempImportedData.config.expiryWindowMonths;
      }

      // 5. Initiales de session (prendre les plus récentes ou celles importées si vides)
      if (tempImportedData.sessionInitials && !state.sessionInitials) {
        state.sessionInitials = tempImportedData.sessionInitials;
        document.getElementById("session-initials").value = state.sessionInitials;
        document.getElementById("form-tech").value = state.sessionInitials;
      }

      showLoading("Fusion et sauvegarde Cloud...");
      try {
        await saveProducts();
        await saveConfig();
        await loadDataFromSupabase();
        showToast("Données fusionnées avec succès !", "success");
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de la fusion : " + err.message, "danger");
      } finally {
        hideLoading();
        closeImportModal();
      }
    }

    function exportAllToCSV() {
      let csv = "data:text/csv;charset=utf-8\ufeff";
      csv += "ID;Section;DIN;Produit;Dosage;Format;Quantité;Expiration;Statut;Date d'Ajout;Saisi Par;Date Résolution;Opérateur;Notes\r\n";

      state.products.forEach(p => {
        let statusText = "Sur tablette";
        if (p.status === 'removed') statusText = "Retiré";
        if (p.status === 'sold') statusText = "Vendu/Absent";

        const row = [
          p.id, p.section, p.din, p.product, p.dosage || '', p.format || '', p.quantity, p.expiryDate,
          statusText, p.dateAdded, p.techInitials, p.removalDate || '', p.removedBy || '',
          p.notes ? p.notes.replace(/;/g, ',') : ''
        ].map(v => `"${v}"`).join(';');
        csv += row + "\r\n";
      });

      const encoded = encodeURI(csv);
      const a = document.createElement('a');
      a.setAttribute("href", encoded);
      a.setAttribute("download", `inventaire_global_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("Fichier Excel (CSV) généré !", "success");
    }

    function exportMonthToCSV() {
      const targetYear = state.targetMonthDate.getFullYear();
      const targetMonthNum = String(state.targetMonthDate.getMonth() + 1).padStart(2, '0');
      const targetMonthKey = `${targetYear}-${targetMonthNum}`;

      const filtered = state.products.filter(p => p.expiryDate === targetMonthKey);

      if (filtered.length === 0) {
        showToast("Aucun produit pour ce mois.", "danger");
        return;
      }

      let csv = "data:text/csv;charset=utf-8\ufeff";
      csv += "Section;DIN;Produit;Dosage;Format;Quantité;Expiration;Statut;Pastille;Date Action;Opérateur;Notes\r\n";

      filtered.forEach(p => {
        const sticker = getStickerInfo(p.expiryDate);
        let statusText = "Sur tablette";
        if (p.status === 'removed') statusText = "Retiré";
        if (p.status === 'sold') statusText = "Vendu/Absent";

        const row = [
          p.section, p.din, p.product, p.dosage || '', p.format || '', p.quantity, p.expiryDate,
          statusText, sticker.name, p.removalDate || '', p.removedBy || '',
          p.notes ? p.notes.replace(/;/g, ',') : ''
        ].map(v => `"${v}"`).join(';');
        csv += row + "\r\n";
      });

      const encoded = encodeURI(csv);
      const a = document.createElement('a');
      a.setAttribute("href", encoded);
      a.setAttribute("download", `checklist_retrait_${targetMonthKey}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Export CSV ${targetMonthKey} complété.`, "success");
    }

    async function resetDatabase() {
      if (confirm("Voulez-vous effacer toutes vos données de saisie ?")) {
        const loadDemo = confirm("Recharger les données de démonstration d'origine ?");
        state.products = loadDemo ? [...demoProducts] : [];
        state.config = {
          expiryWindowMonths: 3,
          sections: [...defaultSections],
          stickerColors: { ...defaultStickerColors }
        };
        showLoading("Réinitialisation...");
        try {
          await saveProducts();
          await saveConfig();
          await loadDataFromSupabase();
          showToast("Base de données réinitialisée.", "success");
        } catch (err) {
          console.error(err);
          showToast("Erreur lors de la réinitialisation : " + err.message, "danger");
        } finally {
          hideLoading();
        }
      }
    }

    // ----------------------------------------------------
    // FONCTIONS UTILITAIRES DE DATE ET TEXTE
    // ----------------------------------------------------
    function showToast(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span>${message}</span>`;
      container.appendChild(toast);
      
      // Auto-suppression après 3 secondes
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }

    function getSortIcon(key) {
      if (state.sorting.key === key) {
        return state.sorting.direction === 'asc' ? ' ▲' : ' ▼';
      }
      return '';
    }

    function loadProductToSaisie(din, product, dosage, format) {
      // Pré-remplir le formulaire
      document.getElementById("form-din").value = (din === "N/A" || din === "") ? "" : din;
      document.getElementById("form-product").value = product;
      document.getElementById("form-dosage").value = (dosage === "N/A" || dosage === "") ? "" : dosage;
      document.getElementById("form-format").value = (format === "N/A" || format === "") ? "" : format;
      document.getElementById("form-qty").value = "1";
      
      // Aperçu pastille
      const formExpiry = document.getElementById("form-expiry").value;
      updateFormStickerPreview(formExpiry);

      // Basculer d'onglet
      const tourneeTabBtn = document.querySelector("[data-tab='tab-tournee']");
      if (tourneeTabBtn) {
        tourneeTabBtn.click();
      }

      // Focus quantité
      setTimeout(() => {
        const qtyInput = document.getElementById("form-qty");
        qtyInput.focus();
        qtyInput.select();
      }, 150);

      showToast(`Produit chargé depuis le catalogue : ${product}`, "success");
    }

    function getStickerInfo(expiryDateStr) {
      const parts = expiryDateStr.split('-');
      if (parts.length === 2) {
        const monthKey = parts[1];
        const colorInfo = state.config.stickerColors[monthKey];
        if (colorInfo) return colorInfo;
      }
      return { name: "Sans couleur", color: "#ccc" };
    }

    function formatMonthYearFrench(dateObj) {
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      return `${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
    }

    function formatMonthNameFrench(monthIndex) {
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      return months[monthIndex];
    }

    function getMonthAbbreviation(monthIndex) {
      const abbrev = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUI", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
      return abbrev[monthIndex];
    }

    function formatFullDateFrench(dateObj) {
      const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
      const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      
      const dayName = days[dateObj.getDay()];
      const dayNum = dateObj.getDate();
      const monthName = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      
      let hours = String(dateObj.getHours()).padStart(2, '0');
      let minutes = String(dateObj.getMinutes()).padStart(2, '0');
      
      return `${dayName} ${dayNum} ${monthName} ${year} à ${hours}h${minutes}`;
    }

    function updateDateDisplays() {
      // Date de session badge
      document.getElementById("current-month-badge").textContent = formatMonthYearFrench(state.currentDate);

      // Mois cible de retrait
      const targetStr = formatMonthYearFrench(state.targetMonthDate);
      document.getElementById("target-month-label").textContent = targetStr;

      // Éléments d'impression
      document.getElementById("print-month-title").textContent = `Mois à retirer : ${targetStr}`;
      document.getElementById("print-date-subtitle").textContent = `Imprimé le : ${formatFullDateFrench(new Date())}`;

      // Visualisation pastille du mois de retrait
      const monthNum = String(state.targetMonthDate.getMonth() + 1).padStart(2, '0');
      const sticker = state.config.stickerColors[monthNum];
      const stickerCircle = document.getElementById("target-month-sticker-circle");
      const stickerDesc = document.getElementById("target-month-sticker-desc");
      
      if (sticker) {
        stickerCircle.style.backgroundColor = sticker.color;
        stickerCircle.textContent = getMonthAbbreviation(state.targetMonthDate.getMonth());
        stickerDesc.textContent = `${sticker.name} (${formatMonthNameFrench(state.targetMonthDate.getMonth())})`;
      }
    }

    function renderAllViews() {
      renderChecklist();
      renderInventoryTable();
      renderRecentEntries();
      updateTourneeAssistant();
      renderConfigPanel();
    }

    // COMPOSANT: TUTORIEL ET GUIDE INTERACTIF (V3.5)
    // ----------------------------------------------------
    function checkAndShowTutorial() {
      const skip = localStorage.getItem("exp_skip_tutorial");
      if (skip !== "true") {
        const overlay = document.getElementById("tutorial-modal-overlay");
        if (overlay) overlay.classList.add("active");
      }
    }

    function closeTutorialModal() {
      const skipCheckbox = document.getElementById("tutorial-skip-checkbox");
      if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem("exp_skip_tutorial", "true");
      }
      const overlay = document.getElementById("tutorial-modal-overlay");
      if (overlay) overlay.classList.remove("active");
    }

    function openGuideFromTutorial() {
      closeTutorialModal();
      
      const guideBtn = document.querySelector('.tab-btn[data-tab="tab-guide"]');
      if (guideBtn) {
        guideBtn.click();
      }
    }

    function toggleAccordion(id) {
      const el = document.getElementById(id);
      const icon = document.getElementById("icon-" + id);
      const isVisible = el.style.display === "block";
      
      // Fermer tous les accordéons d'abord
      document.querySelectorAll(".guide-accordion-body").forEach(body => {
        body.style.display = "none";
      });
      document.querySelectorAll(".guide-accordion-header svg").forEach(svg => {
        svg.style.transform = "rotate(0deg)";
      });
      
      // Ouvrir celui cliqué s'il était fermé
      if (!isVisible) {
        el.style.display = "block";
        if (icon) {
          icon.style.transform = "rotate(180deg)";
          icon.style.transition = "transform 0.2s ease";
        }
      }
    }

    // COMPOSANT: TUTORIEL ET GUIDE INTERACTIF (V3.5)
    // ----------------------------------------------------
    function checkAndShowTutorial() {
      const skip = localStorage.getItem("exp_skip_tutorial");
      if (skip !== "true") {
        const overlay = document.getElementById("tutorial-modal-overlay");
        if (overlay) overlay.classList.add("active");
      }
    }

    function closeTutorialModal() {
      const skipCheckbox = document.getElementById("tutorial-skip-checkbox");
      if (skipCheckbox && skipCheckbox.checked) {
        localStorage.setItem("exp_skip_tutorial", "true");
      }
      const overlay = document.getElementById("tutorial-modal-overlay");
      if (overlay) overlay.classList.remove("active");
    }

    function openGuideFromTutorial() {
      closeTutorialModal();
      
      const guideBtn = document.querySelector('.tab-btn[data-tab="tab-guide"]');
      if (guideBtn) {
        guideBtn.click();
      }
    }

    function toggleAccordion(id) {
      const el = document.getElementById(id);
      const icon = document.getElementById("icon-" + id);
      const isVisible = el.style.display === "block";
      
      // Fermer tous les accordéons d'abord
      document.querySelectorAll(".guide-accordion-body").forEach(body => {
        body.style.display = "none";
      });
      document.querySelectorAll(".guide-accordion-header svg").forEach(svg => {
        svg.style.transform = "rotate(0deg)";
      });
      
      // Ouvrir celui cliqué s'il était fermé
      if (!isVisible) {
        el.style.display = "block";
        if (icon) {
          icon.style.transform = "rotate(180deg)";
          icon.style.transition = "transform 0.2s ease";
        }
      }
    }

    // ====================================================
    // LECTEUR DE CODE-BARRES PAR CAMÉRA (V3.8)
    // ====================================================
    let html5QrcodeScanner = null;
    let currentCameraFacingMode = "environment"; // "environment" = arrière, "user" = avant

    function startScanner() {
      document.getElementById("camera-modal").style.display = "flex";
      const statusDiv = document.getElementById("camera-status");
      if (statusDiv) statusDiv.textContent = "Démarrage de la caméra...";
      
      if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
      }
      
      // Récupérer les formats supportés de manière sécurisée (V3.8)
      let formats = [];
      if (window.Html5QrcodeSupportedFormats) {
        formats = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.ITF
        ];
      }
      
      const config = {
        fps: 24,
        qrbox: (width, height) => {
          // Doit correspondre à la boîte CSS .scan-target-box (80% de large, 40% de haut)
          const sizeWidth = width * 0.8;
          const sizeHeight = height * 0.4;
          return { width: sizeWidth, height: sizeHeight };
        },
        videoConstraints: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: currentCameraFacingMode
        },
        formatsToSupport: formats
      };
      
      html5QrcodeScanner.start(
        { facingMode: currentCameraFacingMode },
        config,
        onScanSuccess,
        onScanFailure
      ).then(() => {
        if (statusDiv) statusDiv.textContent = "Scanner actif. Alignez le code-barres.";
      }).catch(err => {
        console.error("Erreur de démarrage du scanner :", err);
        showToast("Impossible d'accéder à la caméra : " + err, "danger");
        if (statusDiv) statusDiv.textContent = "Erreur : " + err.message;
        stopScanner();
      });
    }
    
    function stopScanner() {
      document.getElementById("camera-modal").style.display = "none";
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
          console.log("[Scanner] Caméra arrêtée.");
        }).catch(err => {
          console.error("[Scanner] Erreur lors de l'arrêt de la caméra :", err);
        });
      }
    }
    
    function switchCamera() {
      currentCameraFacingMode = (currentCameraFacingMode === "environment") ? "user" : "environment";
      showToast("Changement de caméra...", "info");
      
      if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
          startScanner();
        }).catch(err => {
          console.error("Erreur switch caméra :", err);
        });
      } else {
        startScanner();
      }
    }
    
    function playScanBeep() {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = "sine";
        oscillator.frequency.value = 1200; // Bip aigu agréable
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (err) {
        console.log("Impossible d'émettre le son :", err);
      }
    }
    
    function triggerVisualFlash() {
      const flash = document.getElementById("scan-flash-overlay");
      if (flash) {
        flash.style.display = "block";
        setTimeout(() => {
          flash.style.display = "none";
        }, 150);
      }
    }
    
    function onScanSuccess(decodedText) {
      console.log(`[Scanner] Code détecté : ${decodedText}`);
      
      playScanBeep();
      triggerVisualFlash();
      stopScanner();
      
      const dinInput = document.getElementById("form-din");
      dinInput.value = decodedText;
      
      const event = new Event('input', { bubbles: true });
      dinInput.dispatchEvent(event);
      
      const found = checkForExactCodeMatch(decodedText);
      if (!found) {
        document.getElementById("form-product").focus();
        showToast("Code-barres inconnu. Saisissez le DIN associé pour l'enregistrer.", "warning");
      }
    }
    
    function onScanFailure() {
      // Ignorer
    }

    // Lanceur au démarrage
    window.addEventListener("DOMContentLoaded", init);
