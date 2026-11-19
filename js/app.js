/* =====================================
   CONFIGURATION
===================================== */

// URL fournie par Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbyNj73rph-qhZ9CrmiF4bQ35Ax8gnn-m7k0Wd-GMn6WXnP_K9QvdIy1LU318devd4LE/exec";

// Lien vers votre liste de naissance
const BIRTH_LIST_URL = "http://www.millet.com";


/* =====================================
   INITIALISATION
===================================== */

$(document).ready(function () {

    $("#birth-list-link").attr("href", BIRTH_LIST_URL);

    loadInventory();
    setupViewNavigation();
    setupCarousel();

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

            renderBySize(response.inventory);
            renderByType(response.inventory);

        },

        error: function () {
            showError("Impossible de récupérer l'inventaire.");
        }
    });
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



// Regroupement par catégorie, sans sensibilité à la casse.

function groupByType(inventory) {

    const groups = {};
    const categoryNames = {};

    inventory.forEach(function (item) {

        const category = getCategoryName(item.type);
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

    if (normalizeType(getCategoryName(item.type)) === "bodies") {
        return String(item.type).trim();
    }

    return "";
}


/* =====================================
   VUE PAR TAILLE
===================================== */

function renderBySize(inventory) {

    const groups = groupBySize(inventory);

    let html = "";

    Object.keys(groups).forEach(function (taille) {

        html += `
            <section class="size-category">

                <h3>${escapeHTML(taille)}</h3>
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
        `;

    });

    $("#inventory-by-size").html(html);

}


/* =====================================
   VUE PAR VETEMENT
===================================== */

function renderByType(inventory) {

    const groups = groupByType(inventory);

    let html = "";

    Object.keys(groups).forEach(function (type) {

        html += `
            <section class="detail-category">

                <h3>${escapeHTML(type)}</h3>
        `;

        // On regroupe les éléments de cette catégorie par taille.
        const sizes = groupBySize(groups[type]);

        Object.keys(sizes).forEach(function (taille) {

            html += `
                <div class="detail-item">

                    <div class="detail-header">
                        <strong>${escapeHTML(taille)}</strong>
                    </div>
            `;

            sizes[taille].forEach(function (item) {

                const status = getStatus(item);
                const coverage = getCoverage(item);
                const message = getMessage(item, status);
                const variant = getVariantName(item);

                html += `
                    <div class="type-variant ${status.className}">

                        ${variant ? `
                            <div class="detail-variant">
                                ${escapeHTML(variant)}
                            </div>
                        ` : ""}

                        <div class="detail-header">

                            <span>
                                ${item.stock} / ${item.besoin === null ? "?" : item.besoin}
                            </span>

                            <span class="detail-status">
                                ${status.label}
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
                </div>
            `;

        });

        html += `
            </section>
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
            $("#inventory-by-type").prop("hidden", false);
        } else {
            $("#inventory-by-size").prop("hidden", false);
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
