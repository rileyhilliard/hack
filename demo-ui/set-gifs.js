document.addEventListener("DOMContentLoaded", () => {
  const fetchButton = document.getElementById("fetch-gif");
  const gifContainer = document.getElementById("gif-container");

  fetchButton.addEventListener("click", displayRandomGif);

  function displayRandomGif() {
    // Show loading state
    gifContainer.innerHTML = '<p class="loading">Loading your GIF...</p>';

    try {
      // Get a random GIF from the GIFS array
      const randomIndex = Math.floor(Math.random() * window.GIFS.length);
      const gifUrl = window.GIFS[randomIndex];

      // Create and display the image
      // BUG NOTE: This is a bug, and will cause a JS error
      // const img = document.createElement("img");
      img.src = gifUrl;
      img.alt = "Random GIF";

      // Add a loading event to handle when the image is fully loaded
      img.onload = () => {
        gifContainer.innerHTML = "";
        gifContainer.appendChild(img);
      };

      // Add an error handler in case the image fails to load
      img.onerror = () => {
        gifContainer.innerHTML =
          "<p>Oops! Failed to load the GIF. Try again!</p>";
      };

      // Start loading the image
      img.src = gifUrl;
    } catch (error) {
      console.error("Error displaying GIF:", error);
      gifContainer.innerHTML = `<p>Oops! Something went wrong: ${error.message}</p>`;
    }
  }
});
