import { GitHubScreenshotLightbox } from "./lightbox";

(() => {
  if (window.__githubScreenshotLightboxLoaded) {
    return;
  }

  window.__githubScreenshotLightboxLoaded = true;
  new GitHubScreenshotLightbox().install();
})();
