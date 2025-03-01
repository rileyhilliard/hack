document.addEventListener("DOMContentLoaded", () => {
  const feedbackButton = document.getElementById("feedback-button");
  const feedbackDialog = document.getElementById("feedback-dialog");
  const feedbackForm = document.getElementById("feedback-form");
  const cancelButton = document.getElementById("cancel-feedback");
  const feedbackText = document.getElementById("feedback-text");

  // Store all console logs
  const consoleLogs = [];

  // Override console methods to capture logs
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  // Override console methods to store logs
  // Helper function to override console methods
  function overrideConsoleMethod(method, type) {
    return function () {
      const [message, ...rest] = Array.from(arguments);

      if (type === "error" && rest[0] && rest[0].stack) {
        consoleLogs.push({ type, message, stack: rest[0].stack });
      } else {
        consoleLogs.push({ type, message });
      }

      originalConsole[method].apply(console, arguments);
    };
  }

  // Override each console method
  console.log = overrideConsoleMethod("log", "log");
  console.warn = overrideConsoleMethod("warn", "warn");
  console.error = overrideConsoleMethod("error", "error");
  console.info = overrideConsoleMethod("info", "info");

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
      const dedupedLogs = consoleLogs.filter(
        (log, index, self) =>
          index === self.findIndex((t) => t.stack === log.stack)
      );

      // Send feedback and logs to the webhook endpoint
      fetch(
        "http://localhost:5678/webhook-test/b1e84c15-0aef-4eb9-90c6-95fa639e9134",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            github_repo: "hack",
            github_owner: "rileyhilliard",
            feedback,
            logs: dedupedLogs,
          }),
        }
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          originalConsole.log("Feedback sent successfully:", data);
          feedbackText.value = "";
          feedbackDialog.close();
        })
        .catch((error) => {
          originalConsole.error("Error sending feedback:", error);
        });
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
