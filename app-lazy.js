(function () {
  "use strict";

  var photosPromise = null;
  var letterMusicPromise = null;
  var letterMusicUrl = "";
  var cakePrefetched = false;

  function getLetterAudio() {
    return document.querySelector("#smooth-letter-music");
  }

  function hydrateImages() {
    if (!photosPromise) {
      photosPromise = Promise.all(
        ["01", "02", "03"].map(function (part) {
          return fetch("assets/photos.part-" + part + ".js", {
            cache: "force-cache"
          }).then(function (response) {
            if (!response.ok) {
              throw new Error("Photo part " + part + " failed: " + response.status);
            }
            return response.text();
          });
        })
      )
        .then(function (parts) {
          var script = document.createElement("script");
          var url = URL.createObjectURL(
            new Blob([parts.join("")], { type: "application/javascript" })
          );
          return new Promise(function (resolve, reject) {
            script.src = url;
            script.onload = function () {
              URL.revokeObjectURL(url);
              resolve();
            };
            script.onerror = function () {
              URL.revokeObjectURL(url);
              reject(new Error("Photo bundle could not be loaded"));
            };
            document.head.appendChild(script);
          });
        })
        .then(function () {
          var photos = window.__BIRTHDAY_PHOTOS__ || {};
          document.querySelectorAll("img[data-birthday-src]").forEach(function (image) {
            var source = photos[image.getAttribute("data-birthday-src")];
            if (!source) {
              return;
            }
            image.addEventListener(
              "load",
              function () {
                image.classList.add("is-loaded");
              },
              { once: true }
            );
            image.src = source;
          });
        });
    }
    return photosPromise;
  }

  function base64ToBlob(base64, type) {
    var binary = atob(base64.replace(/\s+/g, ""));
    var length = binary.length;
    var bytes = new Uint8Array(length);
    for (var index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: type });
  }

  function loadLetterMusic() {
    if (letterMusicPromise) {
      return letterMusicPromise;
    }

    var audio = getLetterAudio();
    if (!audio) {
      return Promise.resolve();
    }

    letterMusicPromise = Promise.all(
      ["01", "02", "03", "04", "05", "06"].map(function (part) {
        return fetch("assets/letter-music/part-" + part + ".b64", {
          cache: "force-cache"
        }).then(function (response) {
          if (!response.ok) {
            throw new Error("Music part " + part + " failed: " + response.status);
          }
          return response.text();
        });
      })
    )
      .then(function (parts) {
        var blob = base64ToBlob(parts.join(""), "audio/mpeg");
        letterMusicUrl = URL.createObjectURL(blob);
        audio.src = letterMusicUrl;
        audio.preload = "auto";
        audio.load();
        audio.addEventListener(
          "canplay",
          function () {
            if (
              ["letter", "album", "finale"].indexOf(
                document.documentElement.getAttribute("data-ready")
              ) !== -1 &&
              audio.paused
            ) {
              audio.volume = 0.52;
              audio.play().catch(function () {
                // Mobile browsers may wait for the next tap.
              });
            }
          },
          { once: true }
        );
      })
      .catch(function (error) {
        console.warn("Letter music will retry on the next visit.", error);
        letterMusicPromise = null;
      });

    return letterMusicPromise;
  }

  function prefetchCake() {
    if (cakePrefetched) {
      return;
    }
    cakePrefetched = true;
    [
      "cake3d/index.html",
      "cake3d/style.css",
      "assets/cake-script-01.b64",
      "assets/cake-script-02.b64",
      "assets/cake-script-03.b64",
      "assets/cake-script-04.b64",
      "assets/cake-script-05.b64"
    ].forEach(function (url) {
      fetch(url, { cache: "force-cache" }).catch(function () {
        // The iframe will retry normally if prefetching is unavailable.
      });
    });
  }

  window.addEventListener("birthday:unlock", function () {
    prefetchCake();
    window.setTimeout(loadLetterMusic, 4500);
  });

  window.addEventListener("birthday:album-preload", function () {
    hydrateImages();
  });

  window.addEventListener("birthday:screen", function (event) {
    var name = event.detail && event.detail.name;
    if (name === "letter" || name === "album") {
      hydrateImages();
    }
    if (name === "cake") {
      prefetchCake();
    }
    if (name === "letter" || name === "album" || name === "finale") {
      loadLetterMusic();
    }
  });

  window.addEventListener("pagehide", function () {
    if (letterMusicUrl) {
      URL.revokeObjectURL(letterMusicUrl);
      letterMusicUrl = "";
    }
  });
})();
