/* =====================================
   CONFIGURATION
===================================== */

// URL fournie par Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyNj73rph-qhZ9CrmiF4bQ35Ax8gnn-m7k0Wd-GMn6WXnP_K9QvdIy1LU318devd4LE/exec";

const BANK_NAME = "Mortier Tixhon";
const BANK_IBAN = "BE79377144393833";

// Lien vers votre liste de naissance
const BIRTH_LIST_URL = "http://www.millet.com";

let currentGifts = [];
let birthGiftModalLastFocus = null;

/* =====================================
   INITIALISATION
===================================== */

$(document).ready(function () {

    $("#birth-list-link").attr("href", "#birth-gifts-section");

    loadInventory();
    loadGifts();

    setupViewNavigation();
    setupCarousel();

    setupBirthGiftModal();

});


/* =====================================
   RECUPERATION DES DONNEES
===================================== */

function loadInventory() {

    $("#inventory-status").text("Chargement de l'inventaire...");

    $.ajax({
        url: API_URL,
        dataType: "jsonp",
        timeout: 15000,

        success: function (response) {

            if (!response.success) {
                showError(response.error || "Erreur inconnue.");
                return;
            }

            $("#inventory-status").text(
                "Inventaire actualisé le " +
                new Date(response.updated).toLocaleString("fr-BE")
            );

console.log(response.inventory);
            renderBySize(response.inventory);
            renderByType(response.inventory);

        },

        error: function () {
            showError("Impossible de récupérer l'inventaire.");
        }
    });
}


/* =====================================
   LISTE DE NAISSANCE - RECUPERATION
===================================== */

function loadGifts() {

    $("#birth-gifts-status").text("Chargement des cadeaux...");

    $.ajax({
        url: API_URL,
        data: {
            action: "getGifts"
        },
        dataType: "jsonp",
        timeout: 15000,

        success: function (response) {

            if (!response.success) {
                $("#birth-gifts-status").text(
                    response.error || "Impossible de charger les cadeaux."
                );
                return;
            }

            $("#birth-gifts-status").text(
                response.gifts.length
                    ? "Voici les cadeaux que nous avons sélectionnés."
                    : "La liste de naissance sera bientôt disponible."
            );

            renderGifts(response.gifts);
        },

        error: function () {
            $("#birth-gifts-status").text(
                "Impossible de récupérer la liste de naissance. Merci de réessayer."
            );
        }
    });
}


/* =====================================
   LISTE DE NAISSANCE - AFFICHAGE
===================================== */

function renderGifts(gifts) {
    currentGifts = gifts;

    let html = "";

    gifts.forEach(function (gift) {

        const isReservation = gift.mode === "reservation";

        html += `
            <article class="birth-gift-card">

                <div class="birth-gift-image">
                    ${
                        gift.image
                            ? `<img src="${escapeHTML(gift.image)}"
                                    alt="${escapeHTML(gift.nom)}"
                                    loading="lazy">`
                            : ""
                    }
                </div>

                <div class="birth-gift-content">

                    ${gift.categorie
                        ? `<span class="birth-gift-category">
                                ${escapeHTML(gift.categorie)}
                           </span>`
                        : ""
                    }

                    <h3>${escapeHTML(gift.nom)}</h3>

                    ${
                        isReservation
                            ? renderReservationInfo(gift)
                            : renderContributionInfo(gift)
                    }

                    ${renderGiftAction(gift)}

                </div>

            </article>
        `;
    });

    $("#birth-gifts").html(html);
}

/* =====================================
   BOUTON DE PARTICIPATION
===================================== */

function renderGiftAction(gift) {

    const isReservation = gift.mode === "reservation";

    // Pas de bouton si le cadeau n'est plus disponible.
    if (isReservation && Number(gift.quantiteDisponible) <= 0) {
        return "";
    }

    if (!isReservation && Number(gift.resteARecevoir) <= 0) {
        return "";
    }

    return `
        <button
    type="button"
    class="birth-gift-action"
    data-gift-id="${escapeHTML(gift.id)}">
    Plus d'infos et participer
</button>
    `;
}

/* =====================================
   INFORMATIONS - RESERVATION
===================================== */

function renderReservationInfo(gift) {

    const available = gift.quantiteDisponible || 0;

    if (available <= 0) {
        return `
            <div class="birth-gift-progress sold-out">
                <strong>Déjà réservé !</strong>
                <p>Merci, ce cadeau a trouvé preneur.</p>
            </div>
        `;
    }

    return `
        <div class="birth-gift-progress">
            <strong>${available} disponible${available > 1 ? "s" : ""}</strong>
        </div>
    `;
}


/* =====================================
   INFORMATIONS - CONTRIBUTION
===================================== */

function renderContributionInfo(gift) {

    const price = Number(gift.prix) || 0;
    const received = Number(gift.montantRecu) || 0;
    const pending = Number(gift.montantEnAttente) || 0;
    const remaining = Number(gift.resteARecevoir) || 0;

    // Total déjà récolté ou promis
    const totalCommitted = received + pending;

    const receivedPercentage = price > 0
        ? Math.min(100, received / price * 100)
        : 0;

    const pendingPercentage = price > 0
        ? Math.min(100 - receivedPercentage, pending / price * 100)
        : 0;

    return `
        <div class="birth-gift-progress">

            <div class="birth-gift-amounts">
                <strong>
                    ${totalCommitted.toFixed(2)} € récoltés ou promis
                </strong>
                <span>sur ${price.toFixed(2)} €</span>
            </div>

            <div class="progress-bar">
                <div class="progress-fill received"
                     style="width: ${receivedPercentage}%">
                </div>

                <div class="progress-fill pending"
                     style="width: ${pendingPercentage}%">
                </div>
            </div>

        </div>
    `;
}

/* =====================================
   FORMULAIRE - RESERVATION
===================================== */

function renderReservationForm(gift) {

    const available = gift.quantiteDisponible || 0;

    if (available <= 0) {
        return "";
    }

    return `
        <form class="birth-gift-form" data-type="reservation">

            <input type="hidden" name="giftId"
                   value="${escapeHTML(gift.id)}">

            <label>
                Quantité
                <input type="number"
                       name="quantity"
                       min="1"
                       max="${available}"
                       value="1"
                       required>
            </label>

            ${renderParticipantFields()}

            <button type="submit">
                Réserver ce cadeau
            </button>

            <p class="form-feedback" aria-live="polite"></p>

        </form>
    `;
}


/* =====================================
   FORMULAIRE - CONTRIBUTION
===================================== */

function renderContributionForm(gift) {

    const remaining = Number(gift.resteARecevoir) || 0;

    if (remaining <= 0) {
        return "";
    }

    return `
        <form class="birth-gift-form" data-type="contribution">

            <input type="hidden" name="giftId"
                   value="${escapeHTML(gift.id)}">

            <label>
                Votre participation (€)
                <input type="number"
                       name="amount"
                       min="0.01"
                       max="${remaining.toFixed(2)}"
                       step="0.01"
                       placeholder="Ex. 25"
                       required>
            </label>

            ${renderParticipantFields()}

            <button type="submit">
                Participer à ce cadeau
            </button>

            <p class="form-feedback" aria-live="polite"></p>

        </form>
    `;
}

/* =====================================
   FENETRE MODALE - PARTICIPATION
===================================== */

function setupBirthGiftModal() {

    // Création de la fenêtre si elle n'existe pas encore.
    if ($("#birth-gift-modal").length === 0) {

        $("body").append(`
            <div id="birth-gift-modal" class="birth-gift-modal" hidden>

                <div class="birth-gift-modal-backdrop"
                     data-modal-close>
                </div>

                <div class="birth-gift-modal-dialog"
                     role="dialog"
                     aria-modal="true"
                     aria-labelledby="birth-gift-modal-title"
                     tabindex="-1">

                    <button type="button"
                            class="birth-gift-modal-close"
                            aria-label="Fermer"
                            data-modal-close>
                        &times;
                    </button>

                    <h2 id="birth-gift-modal-title"></h2>

                    <div id="birth-gift-modal-content"></div>

                </div>

            </div>
        `);
    }

    // Ouverture de la fenêtre au clic sur un cadeau.
    $(document).on("click", ".birth-gift-action", function () {

        const giftId = String($(this).data("gift-id"));

        const gift = currentGifts.find(function (item) {
            return String(item.id) === giftId;
        });

        if (!gift) return;

        const isReservation = gift.mode === "reservation";

        const form = isReservation
            ? renderReservationForm(gift)
            : renderContributionForm(gift);

        if (!form) return;

        birthGiftModalLastFocus = document.activeElement;

        $("#birth-gift-modal-title").text(
            isReservation
                ? "Réserver : " + gift.nom
                : "Participer : " + gift.nom
        );

        const image = gift.image
    ? `
        <div class="birth-gift-modal-image">
            <img src="${escapeHTML(gift.image)}"
                 alt="${escapeHTML(gift.nom)}">
        </div>
      `
    : "";

const description = gift.description
    ? `
        <div class="birth-gift-modal-description">
            ${escapeHTML(gift.description)}
        </div>
      `
    : "";

$("#birth-gift-modal-content").html(`
    ${image}
    ${description}
    ${form}
`);

        $("#birth-gift-modal")
            .prop("hidden", false);

        $("body").addClass("modal-open");

        $("#birth-gift-modal .birth-gift-modal-close").trigger("focus");
    });

    // Fermeture par le bouton ou le fond sombre.
    $(document).on("click", "[data-modal-close]", function () {
        closeBirthGiftModal();
    });

    // Fermeture avec la touche Escape.
    $(document).on("keydown", function (event) {

        if (
            event.key === "Escape" &&
            !$("#birth-gift-modal").prop("hidden")
        ) {
            closeBirthGiftModal();
        }
    });
}


function closeBirthGiftModal() {

    $("#birth-gift-modal").prop("hidden", true);

    $("body").removeClass("modal-open");

    // On replace le focus sur le bouton qui avait ouvert la fenêtre.
    if (
        birthGiftModalLastFocus &&
        document.contains(birthGiftModalLastFocus)
    ) {
        birthGiftModalLastFocus.focus();
    }

    birthGiftModalLastFocus = null;
}


/* =====================================
   CHAMPS COMMUNS AUX FORMULAIRES
===================================== */

function renderParticipantFields() {

    return `
        <label>
            Votre nom
            <input type="text"
                   name="name"
                   maxlength="100"
                   autocomplete="name"
                   required>
        </label>

        <label>
            Votre adresse e-mail
            <input type="email"
                   name="email"
                   maxlength="254"
                   autocomplete="email"
                   required>
        </label>

        <div class="website-field" aria-hidden="true">
            <label>
                Ne pas remplir
                <input type="text"
                       name="website"
                       tabindex="-1"
                       autocomplete="off">
            </label>
        </div>
    `;
}

/* =====================================
   QR CODE EPC - VIREMENT SEPA
===================================== */

function buildEpcPayload(amount, communication) {

    const name = String(BANK_NAME || "")
        .trim()
        .replace(/[\r\n]+/g, " ");

    const iban = String(BANK_IBAN || "")
        .replace(/\s/g, "")
        .toUpperCase();

    const paymentAmount = Number(amount);

    const remittance = String(communication || "")
        .replace(/[\r\n]+/g, " ")
        .trim();

    // Vérification du bénéficiaire
    if (!name || name.length > 70) {
        throw new Error("Le nom du bénéficiaire est invalide.");
    }

    // Vérification de l'IBAN belge
    if (!/^BE\d{14}$/.test(iban)) {
        throw new Error("L'IBAN belge renseigné est invalide.");
    }

    // Vérification du montant
    if (
        !Number.isFinite(paymentAmount) ||
        paymentAmount <= 0 ||
        paymentAmount > 999999999.99
    ) {
        throw new Error("Le montant du virement est invalide.");
    }

    // Vérification de la communication
    if (!remittance || remittance.length > 140) {
        throw new Error("La communication doit contenir entre 1 et 140 caractères.");
    }

    const formattedAmount = paymentAmount.toFixed(2);

    // Format EPC 002 : le BIC est facultatif.
    // Les champs non utilisés sont conservés vides.
    const fields = [
        "BCD",
        "002",
        "1",
        "SCT",
        "",
        name,
        iban,
        "EUR" + formattedAmount,
        "",
        "",
        remittance
    ];

    const payload = fields.join("\n");

    // La spécification EPC limite le payload à 331 octets.
    if (new Blob([payload]).size > 331) {
        throw new Error("Les informations du virement dépassent la taille autorisée.");
    }

    return payload;
}


/* =====================================
   AFFICHAGE DU QR CODE EPC
===================================== */

function renderEpcPayment(container, amount, communication) {

    const $payment = $("<div>", {
        class: "epc-payment"
    }).appendTo(container);

    $("<h3>")
        .text("Pour finaliser votre participation")
        .appendTo($payment);

    $("<p>")
        .text("Scannez ce QR code avec votre application bancaire pour préparer le virement.")
        .appendTo($payment);

    const $qr = $("<div>", {
        class: "epc-qr-code"
    }).appendTo($payment);

    // Informations lisibles sous le QR code
    const $details = $("<div>", {
        class: "epc-payment-details"
    }).appendTo($payment);

    function addDetail(label, value) {
        const $line = $("<p>").appendTo($details);

        $("<strong>")
            .text(label + " : ")
            .appendTo($line);

        $("<span>")
            .text(value)
            .appendTo($line);
    }

    const formattedAmount = Number(amount)
        .toFixed(2)
        .replace(".", ",") + " €";

    const readableIban = BANK_IBAN
        .replace(/\s/g, "")
        .toUpperCase()
        .replace(/(.{4})/g, "$1 ")
        .trim();

    addDetail("Montant", formattedAmount);
    addDetail("Bénéficiaire", BANK_NAME);
    addDetail("IBAN", readableIban);
    addDetail("Communication", communication);

    try {

        if (typeof QRCode === "undefined") {
            throw new Error("La bibliothèque QRCode n'est pas chargée.");
        }

        const payload = buildEpcPayload(amount, communication);

        new QRCode($qr[0], {
            text: payload,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

    } catch (error) {

        console.error("Erreur QR EPC :", error);

        $qr.remove();

        $("<p>", {
            class: "epc-qr-error",
            text: "Le QR code n'a pas pu être généré. Vous pouvez effectuer le virement manuellement avec les informations ci-dessus."
        }).appendTo($payment);
    }
}

/* =====================================
   ENVOI DES PARTICIPATIONS
===================================== */

// Gestion des formulaires créés dynamiquement
$(document).on("submit", ".birth-gift-form", function (event) {

    event.preventDefault();

    const form = this;
    const $form = $(form);
    const $button = $form.find('button[type="submit"]');
    const $feedback = $form.find(".form-feedback");

    if (!form.reportValidity()) {
        return;
    }

    const formData = new FormData(form);

    const data = {
        type: form.dataset.type,
        giftId: formData.get("giftId"),
        name: formData.get("name"),
        email: formData.get("email"),
        quantity: formData.get("quantity"),
        amount: formData.get("amount"),
        website: formData.get("website")
    };

    // Évite les doubles clics
    $button.prop("disabled", true);
    $button.text("Envoi en cours...");
    $feedback.text("");

    submitParticipation(data, function (result, uncertain) {

        if (result && result.success) {

    // Masque le formulaire
    $form.hide();

    // Crée le bloc de confirmation
    const $confirmation = $("<div>", {
        class: "participation-confirmation success",
        role: "status"
    });

    $("<p>")
        .text(result.message)
        .appendTo($confirmation);

    $form.after($confirmation);

    // Pour une contribution, affiche les informations
    // de paiement et le QR code EPC.
    if (
        result.type === "contribution" &&
        result.communication
    ) {
        renderEpcPayment(
            $confirmation[0],
            data.amount,
            result.communication
        );
    }

    // Actualise les disponibilités
    loadGifts();

    return;
}

        if (uncertain) {
            $feedback
                .removeClass("success")
                .addClass("error")
                .text(
                    "Nous n'avons pas pu confirmer le résultat de votre demande. " +
                    "Veuillez actualiser la page et vérifier la disponibilité avant de réessayer."
                );
        } else {
            $feedback
                .removeClass("success")
                .addClass("error")
                .text(
                    result && result.message
                        ? result.message
                        : "Une erreur est survenue. Merci de réessayer."
                );
        }

        $button.prop("disabled", false);

        $button.text(
            data.type === "reservation"
                ? "Réserver ce cadeau"
                : "Participer à ce cadeau"
        );
    });
});


/* =====================================
   COMMUNICATION AVEC APPS SCRIPT
===================================== */

function verifyParticipation(token, callback, attemptsLeft) {

    $.ajax({
        url: API_URL,
        data: {
            action: "checkParticipation",
            token: token
        },
        dataType: "jsonp",
        timeout: 10000,

        success: function(response) {

            if (
                response.success &&
                response.found &&
                response.participation
            ) {
                callback(response.participation);
                return;
            }

            if (attemptsLeft > 1) {
                setTimeout(function() {
                    verifyParticipation(
                        token,
                        callback,
                        attemptsLeft - 1
                    );
                }, 1500);

                return;
            }

            callback(null);
        },

        error: function() {

            if (attemptsLeft > 1) {
                setTimeout(function() {
                    verifyParticipation(
                        token,
                        callback,
                        attemptsLeft - 1
                    );
                }, 1500);

                return;
            }

            callback(null);
        }
    });
}

function submitParticipation(data, callback) {

    const nonce = (
        window.crypto && typeof window.crypto.randomUUID === "function"
    )
        ? window.crypto.randomUUID()
        : Date.now() + "-" + Math.random().toString(36).slice(2);

    const iframe = document.createElement("iframe");
    iframe.name = "frisko-frame-" + nonce;
    iframe.style.display = "none";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = API_URL;
    form.target = iframe.name;
    form.style.display = "none";

    const fields = {
    ...data,
    nonce: nonce,
    requestToken: nonce
};

    Object.keys(fields).forEach(function (key) {

        const input = document.createElement("input");

        input.type = "hidden";
        input.name = key;
        input.value = fields[key] === null || fields[key] === undefined
            ? ""
            : fields[key];

        form.appendChild(input);
    });

    let completed = false;

    function cleanup() {
        window.removeEventListener("message", receiveMessage);
        clearTimeout(timeout);
        form.remove();
        iframe.remove();
    }

    function finish(result, uncertain) {

        if (completed) return;

        completed = true;
        cleanup();

        callback(result, uncertain);
    }

    function receiveMessage(event) {

        if (event.source !== iframe.contentWindow) {
            return;
        }

        const message = event.data;

        if (
            !message ||
            message.source !== "frisko-api" ||
            message.nonce !== nonce
        ) {
            return;
        }

        finish(message.response, false);
    }

    window.addEventListener("message", receiveMessage);

    // En cas de problème réseau ou de réponse bloquée.
    // La participation peut malgré tout avoir été enregistrée.
    const timeout = setTimeout(function () {

    // La réponse normale n'est pas arrivée.
    // On vérifie si Apps Script a tout de même enregistré la demande.

    verifyParticipation(nonce, function(result) {

        if (result) {
            finish(result, false);
        } else {
            finish(null, true);
        }

    }, 3);

}, 6000);

    document.body.appendChild(iframe);
    document.body.appendChild(form);

    form.submit();
}

/* =====================================
   CALCULS ET STATUTS
===================================== */

function getCoverage(item) {

    if (item.besoin === null) return null;

    if (item.besoin === 0) return 100;

    return Math.min(
        100,
        Math.round((item.stock / item.besoin) * 100)
    );
}


function getStatus(item) {

    if (item.besoin === null) {
        return {
            label: "BESOIN À DÉFINIR",
            className: "neutral"
        };
    }

    if (item.stock >= item.besoin) {
        return {
            label: "SOLD OUT",
            className: "sold-out"
        };
    }

    if (item.stock === 0) {
        return {
            label: "À COMBLER",
            className: "urgent"
        };
    }

    return {
        label: "ENCORE DES BESOINS",
        className: "available"
    };
}


function getMessage(item, status) {

    if (item.besoin === null) {
        return `Besoin à définir — ${item.stock} déjà en stock`;
    }

    const missing = Math.max(0, item.besoin - item.stock);
    const surplus = Math.max(0, item.stock - item.besoin);

    if (status.className === "sold-out") {

        return surplus > 0
            ? `SOLD OUT — Merci de ne plus en acheter ! (+${surplus})`
            : "SOLD OUT — Merci de ne plus en acheter !";
    }

    if (status.className === "urgent") {
        return `Il nous en manque ${missing} !`;
    }

    return `Encore ${missing} à trouver`;
}


/* =====================================
   ORGANISATION DES DONNEES
===================================== */

// Regroupement par taille

function groupBySize(inventory) {

    return inventory.reduce(function (groups, item) {

        if (!groups[item.taille]) {
            groups[item.taille] = [];
        }

        groups[item.taille].push(item);

        return groups;

    }, {});
}

// Normalise un nom pour comparer sans tenir compte
// des majuscules, des accents ou des espaces superflus.

function normalizeType(type) {

    return String(type || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}


// Nom de catégorie affiché sur le site.
// Normalisation des noms de catégories
// Les bodies manches courtes et longues
// seront réunis sous le nom "Bodies".

function getCategoryName(type) {

    const normalized = normalizeType(type);

    // Regroupe body, bodies, Body, BODIES, etc.
    if (/^bod(?:y|ies)\b/.test(normalized)) {
        return "Bodies";
    }

    return String(type).trim();
}

function createAnchorId(name, index, prefix) {
    const slug = normalizeType(name)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return prefix + "-" + slug + "-" + index;
}


// Regroupement par catégorie.
// Si la catégorie est vide, on conserve le regroupement automatique précédent.
function groupByType(inventory) {

    const groups = {};
    const categoryNames = {};

    inventory.forEach(function (item) {

        // Priorité à la catégorie définie dans Google Sheets.
        // Sinon, on utilise l'ancienne détection automatique.
        const category = item.categorie && item.categorie.trim() !== ""
            ? item.categorie.trim()
            : getCategoryName(item.type);

        // Clé normalisée pour éviter les doublons liés à la casse ou aux accents.
        const key = normalizeType(category);

        if (!groups[key]) {
            groups[key] = [];
            categoryNames[key] = category;
        }

        groups[key].push(item);

    });

    // On conserve les noms lisibles comme clés d'affichage.
    const result = {};

    Object.keys(groups).forEach(function (key) {
        result[categoryNames[key]] = groups[key];
    });

    return result;
}

// Pour les bodies, on conserve le détail des manches.

function getVariantName(item) {

    // On utilise la catégorie du tableur si elle existe.
    // Sinon, on conserve la détection automatique.
    const category = item.categorie && item.categorie.trim() !== ""
        ? item.categorie.trim()
        : getCategoryName(item.type);

    // Si le type est différent de la catégorie,
    // on affiche le type comme détail/variante.
    if (normalizeType(category) !== normalizeType(item.type)) {
        return String(item.type).trim();
    }

    return "";
}


/* =====================================
   VUE PAR TAILLE
===================================== */

function renderBySize(inventory) {

    const groups = groupBySize(inventory);
    const sizes = Object.keys(groups);

    let html = "";

    // Navigation par taille
html += '<nav class="inventory-nav">';

sizes.forEach(function (taille, index) {
    const id = createAnchorId(taille, index, "size");

    html += `
        <a href="#${id}" class="inventory-nav-button">
            ${escapeHTML(taille)}
        </a>
    `;
});

html += '</nav>';

    sizes.forEach(function (taille, index) {

        const id = createAnchorId(taille, index, "size");

        html += `
            <details class="inventory-group" id="${id}">

                <summary class="inventory-group-title">
                    ${escapeHTML(taille)}
                </summary>

                <section class="size-category">
        `;

        groups[taille].forEach(function (item) {

            const status = getStatus(item);
            const coverage = getCoverage(item);
            const message = getMessage(item, status);

            html += `
                <div class="size-item ${status.className}">

                    <div class="size-item-header">

                        <span class="size-item-name">
                            ${escapeHTML(item.type)}
                        </span>

                        <span class="size-item-count">
                            ${item.stock} / ${item.besoin === null ? "?" : item.besoin}
                        </span>

                    </div>

                    <div class="progress-bar">
                        <div
                            class="progress-fill ${status.className}"
                            style="width: ${coverage === null ? 0 : coverage}%">
                        </div>
                    </div>

                    <div class="detail-message">
                        ${escapeHTML(message)}
                    </div>

                </div>
            `;

        });

        html += `
                </section>

            </details>
        `;

    });

    $("#inventory-by-size").html(html);

}

/* =====================================
   VUE PAR VETEMENT
===================================== */

// Génère les boutons de navigation
function renderInventoryNav(names, prefix, container) {
    let navHtml = '<nav class="inventory-nav">';

    names.forEach(function (name, index) {
        const id = createAnchorId(name, index, prefix);

        navHtml += `
            <a href="#${id}" class="inventory-nav-button">
                ${escapeHTML(name)}
            </a>
        `;
    });

    navHtml += '</nav>';

    $(container).html(navHtml);
}


// Ouvre automatiquement le groupe correspondant à l'ancre
$(document).on("click", ".inventory-nav a", function () {
    const targetId = $(this).attr("href");
    const target = document.querySelector(targetId);

    if (target && target.tagName === "DETAILS") {
        target.open = true;
    }
});


// AFFICHAGE PAR VÊTEMENT
function renderByType(inventory) {
    const groups = groupByType(inventory);
    const types = Object.keys(groups);

    let html = "";

       // Navigation par taille
html += '<nav class="inventory-nav">';

types.forEach(function (type, index) {
    const id = createAnchorId(type, index, "type");

    html += `
        <a href="#${id}" class="inventory-nav-button">
            ${escapeHTML(type)}
        </a>
    `;
});

html += '</nav>';

    types.forEach(function (type, index) {
        const id = createAnchorId(type, index, "type");

        html += `
            <details class="inventory-group" id="${id}">
                <summary class="inventory-group-title">
                    ${escapeHTML(type)}
                </summary>
                <section class="detail-category">
        `;

        const sizes = groupBySize(groups[type]);

        Object.keys(sizes).forEach(function (taille) {
            html += `
                <div class="detail-item">
                    <div class="size-group-heading">
                        <span class="size-group-label">TAILLE</span>
                        <strong>${escapeHTML(taille)}</strong>
                    </div>

                    <div class="size-group-items">
            `;

            sizes[taille].forEach(function (item) {
                const status = getStatus(item);
                const coverage = getCoverage(item);
                const message = getMessage(item, status);
                const variant = getVariantName(item);

                html += `
                    <div class="type-variant ${status.className}">
                        <div class="size-item-header">
                            <span class="size-item-name">
                                ${escapeHTML(variant || item.type)}
                            </span>
                            <span class="size-item-count">
                                ${item.stock} / ${item.besoin === null ? "?" : item.besoin}
                            </span>
                        </div>

                        <div class="progress-bar">
                            <div class="progress-fill ${status.className}"
                                style="width: ${coverage === null ? 0 : coverage}%">
                            </div>
                        </div>

                        <div class="detail-message">
                            ${escapeHTML(message)}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `
                </section>
            </details>
        `;
    });

    $("#inventory-by-type").html(html);
}

/* =====================================
   NAVIGATION ENTRE LES VUES
===================================== */

function setupViewNavigation() {

    $(".view-button").on("click", function () {

        const view = $(this).data("view");

        $(".view-button").removeClass("active");
        $(this).addClass("active");

        $(".inventory-view").prop("hidden", true);

        if (view === "size") {
            $("#inventory-by-size").prop("hidden", false);
        } else {
            $("#inventory-by-type").prop("hidden", false);
        }

    });

}


/* =====================================
   CARROUSEL PHOTOS
===================================== */

function setupCarousel() {

    const $carousel = $("#photo-carousel");
    const $slides = $carousel.find(".carousel-slide");
    const $dots = $(".carousel-dots");

    let currentIndex = 0;
    let timer = null;

    // On retire les photos qui ne sont pas encore disponibles.
    // Cela permet de laisser seulement 2 ou 3 photos si nécessaire.

    let pendingImages = $slides.length;

    $slides.each(function () {

        const $slide = $(this);
        const $image = $slide.find("img");

        function imageChecked() {

            pendingImages--;

            if (pendingImages === 0) {
                initializeSlides();
            }
        }

        if ($image[0].complete) {
            if (!$image[0].naturalWidth) {
                $slide.remove();
            }
            imageChecked();
        } else {

            $image.on("load", imageChecked);

            $image.on("error", function () {
                $slide.remove();
                imageChecked();
            });

        }

    });


    function initializeSlides() {

        const $visibleSlides = $carousel.find(".carousel-slide");

        // Aucune photo disponible : on masque la section.
        if ($visibleSlides.length === 0) {
            $(".photo-section").hide();
            return;
        }

        if ($visibleSlides.length === 1) {
            $carousel.find(".carousel-arrow").hide();
            $dots.hide();
        }

        $visibleSlides.each(function (index) {

            const $dot = $("<button>", {
                class: "carousel-dot",
                type: "button",
                "aria-label": "Afficher la photo " + (index + 1)
            });

            $dot.on("click", function () {
                goToSlide(index);
                restartTimer();
            });

            $dots.append($dot);

        });

        updateCarousel();

        if ($visibleSlides.length > 1) {
            startTimer();
        }

        $carousel.find(".carousel-next").on("click", function () {
            goToSlide(currentIndex + 1);
            restartTimer();
        });

        $carousel.find(".carousel-prev").on("click", function () {
            goToSlide(currentIndex - 1);
            restartTimer();
        });

    }


    function updateCarousel() {

        const $visibleSlides = $carousel.find(".carousel-slide");

        const offset = currentIndex * 100;

        $carousel.find(".carousel-track").css(
            "transform",
            "translateX(-" + offset + "%)"
        );

        $dots.find(".carousel-dot")
            .removeClass("active")
            .eq(currentIndex)
            .addClass("active");

    }


    function goToSlide(index) {

        const count = $carousel.find(".carousel-slide").length;

        currentIndex = (index + count) % count;

        updateCarousel();

    }


    function startTimer() {

        timer = setInterval(function () {
            goToSlide(currentIndex + 1);
        }, 6000);

    }


    function restartTimer() {

        clearInterval(timer);

        if ($carousel.find(".carousel-slide").length > 1) {
            startTimer();
        }

    }

}


/* =====================================
   UTILITAIRES
===================================== */

function escapeHTML(value) {
    return $("<div>").text(value).html();
}


function showError(message) {

    $("#inventory-status").text(
        "Erreur : " + message +
        " Merci de réessayer ultérieurement."
    );

    $("#inventory-by-size").empty();
    $("#inventory-by-type").empty();

}
