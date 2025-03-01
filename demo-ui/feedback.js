document.addEventListener("DOMContentLoaded", () => {
  const feedbackButton = document.getElementById("feedback-button");
  const feedbackDialog = document.getElementById("feedback-dialog");
  const feedbackForm = document.getElementById("feedback-form");
  const cancelButton = document.getElementById("cancel-feedback");
  const feedbackText = document.getElementById("feedback-text");

  // Open dialog when feedback button is clicked
  feedbackButton.addEventListener("click", () => {
    feedbackDialog.showModal();
    feedbackText.focus();
  });

  // Close dialog when cancel button is clicked
  cancelButton.addEventListener("click", () => {
    feedbackDialog.close();
    feedbackText.value = ""; // Clear the textarea
  });

  // Handle form submission
  feedbackForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const feedback = feedbackText.value.trim();

    if (feedback) {
      console.log("make API call here", { feedback });
    }
  });

  // Close dialog when clicking outside (optional)
  feedbackDialog.addEventListener("click", (e) => {
    const dialogDimensions = feedbackDialog.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      feedbackDialog.close();
    }
  });
});
