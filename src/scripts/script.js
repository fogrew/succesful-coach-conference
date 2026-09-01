// Reusable drag-to-scroll slider + fullscreen FLIP-transition dialog, shared
// by every `[data-gallery]` instance (reviews, last year's photos, ...).
document.addEventListener('DOMContentLoaded', function () {
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  // Matches the breakpoint the gallery dialog itself switches its arrows to
  // a bottom bar at (see gallery.scss).
  function isMobileViewport() {
    return window.matchMedia('(max-width: 700px)').matches;
  }

  function transformToFit(fromRect, toRect) {
    const deltaX = fromRect.left - toRect.left;
    const deltaY = fromRect.top - toRect.top;
    const scaleX = fromRect.width / toRect.width;
    const scaleY = fromRect.height / toRect.height;

    return `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
  }

  function initGalleryDialog(root) {
    const dialog = root.querySelector('[data-gallery-dialog]');

    if (!dialog) {
      return;
    }

    const dialogImg = dialog.querySelector('[data-gallery-dialog-img]');
    const dialogLink = dialog.querySelector('[data-gallery-dialog-link]');
    const loader = dialog.querySelector('[data-gallery-loader]');
    const closeBtn = dialog.querySelector('[data-gallery-close]');
    const prevBtn = dialog.querySelector('[data-gallery-prev]');
    const nextBtn = dialog.querySelector('[data-gallery-next]');
    let activeThumb = null;
    let visibilityObserver = null;

    function getThumbs() {
      return [...root.querySelectorAll('[data-gallery-open]')];
    }

    function showLoader() {
      loader?.removeAttribute('hidden');
    }

    function hideLoader() {
      loader?.setAttribute('hidden', '');
    }

    function stopWatchingVisibility() {
      if (visibilityObserver) {
        visibilityObserver.disconnect();
        visibilityObserver = null;
      }
    }

    // navigate() below scrolls the page itself to bring the next/previous
    // thumbnail into view (see there) - both scroll-close mechanisms in this
    // file need to ignore that scroll, or paging to a thumbnail that isn't
    // already on screen closes the very dialog it just navigated. Set right
    // before a programmatic scroll starts; cleared once it's actually done.
    let scrollCloseSuppressed = false;
    let scrollCloseSuppressTimeout = null;

    function suppressScrollClose() {
      scrollCloseSuppressed = true;
      clearTimeout(scrollCloseSuppressTimeout);

      const release = () => {
        scrollCloseSuppressed = false;
        window.removeEventListener('scrollend', release);
      };

      window.addEventListener('scrollend', release, { once: true });
      // Safety net for browsers without scrollend, or a scrollIntoView call
      // that (e.g. the target was already on screen) never actually scrolls.
      scrollCloseSuppressTimeout = setTimeout(release, 1000);
    }

    // On mobile the arrows sit in a bottom bar rather than reserving side
    // margins, so nothing stops the page itself from scrolling under the
    // dialog - closing on the first scroll reads as a natural swipe-to-
    // dismiss instead of leaving the photo pinned over content moving past.
    let scrollCloseArmed = false;

    function onPageScroll() {
      if (scrollCloseSuppressed) {
        return;
      }
      closeDialog();
    }

    function armScrollClose() {
      if (scrollCloseArmed || !isMobileViewport()) {
        return;
      }
      scrollCloseArmed = true;
      window.addEventListener('scroll', onPageScroll, { passive: true });
    }

    function disarmScrollClose() {
      if (!scrollCloseArmed) {
        return;
      }
      scrollCloseArmed = false;
      window.removeEventListener('scroll', onPageScroll);
    }

    // If the page scrolls far enough that the thumbnail behind the open
    // dialog leaves the viewport, close the dialog. The observer's own
    // *first* callback just reports whatever the current state happens to be
    // (which, right after a programmatic scrollIntoView, may briefly be
    // "not visible" while that scroll is still catching up) - only real
    // subsequent changes should be able to trigger a close.
    function watchVisibility(thumb) {
      stopWatchingVisibility();

      let baselineSeen = false;

      visibilityObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];

          if (!entry) {
            return;
          }

          if (!baselineSeen) {
            baselineSeen = true;
            return;
          }

          if (!entry.isIntersecting && !scrollCloseSuppressed) {
            closeDialog();
          }
        },
        { threshold: 0 },
      );

      visibilityObserver.observe(thumb);
    }

    function applyGalleryContent(thumb) {
      activeThumb = thumb;
      dialogImg.alt = thumb.dataset.alt || '';
      // Read the already-rendered thumbnail <img>'s own src rather than a
      // separate data-full path: Vite rewrites src to the hashed build
      // output, but a plain data-* attribute is just inert text to it and
      // would still point at a source path that doesn't exist in dist.
      dialogImg.src = thumb.querySelector('img')?.src || '';
      watchVisibility(thumb);

      if (dialogLink) {
        if (thumb.dataset.link) {
          dialogLink.href = thumb.dataset.link;
          dialogLink.hidden = false;
        } else {
          dialogLink.removeAttribute('href');
          dialogLink.hidden = true;
        }
      }
    }

    function openDialog(thumb) {
      // Flip from the actual <img> box, not the button around it: the button
      // is always the full fixed row height, but a shorter image is centered
      // inside it - using the button's rect would stretch the flip to that
      // container size instead of the image's real (and possibly smaller) one.
      const thumbImg = thumb.querySelector('img');
      const firstRect = (thumbImg || thumb).getBoundingClientRect();

      applyGalleryContent(thumb);
      // The close button only appears once the flip has actually landed -
      // showing it mid-flight invites a click that closes an animation that
      // hasn't finished yet.
      closeBtn.hidden = true;
      // On a slow connection the browser can paint the new src at its natural
      // (Last) position as soon as enough of it has streamed in - which can
      // happen well before our own decode()/RAF below gets around to setting
      // the inverted (First) transform. Staying invisible until that transform
      // is actually in place keeps that race from ever being seen.
      dialogImg.style.visibility = reduceMotion ? '' : 'hidden';

      if (reduceMotion) {
        hideLoader();
      } else {
        showLoader();
      }

      dialog.showModal();
      // After showModal(), not before - some browsers scroll to bring the
      // (already-centered) dialog into view as part of opening it, and that
      // scroll shouldn't immediately trip the listener we're about to arm.
      armScrollClose();

      if (reduceMotion) {
        closeBtn.hidden = false;
        return;
      }

      // Source images have arbitrary proportions, so the dialog image's box
      // isn't known until the browser has decoded it - flipping before that
      // would measure the wrong (or a collapsed) rect.
      const runFlip = () => {
        // Invert: snap the now-full-size image to look like the thumbnail (First -> Last, inverted)
        const lastRect = dialogImg.getBoundingClientRect();

        dialogImg.style.transformOrigin = 'top left';
        dialogImg.style.transition = 'none';
        dialogImg.style.transform = transformToFit(firstRect, lastRect);
        dialogImg.style.visibility = 'visible';
        hideLoader();

        // force reflow so the inverted transform above applies before we animate it away
        dialogImg.getBoundingClientRect();

        let revealed = false;
        const revealCloseButton = () => {
          if (revealed) {
            return;
          }
          revealed = true;
          dialogImg.removeEventListener('transitionend', onTransitionEnd);
          closeBtn.hidden = false;
        };
        const onTransitionEnd = (event) => {
          if (
            event.target === dialogImg &&
            event.propertyName === 'transform'
          ) {
            revealCloseButton();
          }
        };

        dialogImg.addEventListener('transitionend', onTransitionEnd);
        // Safety net in case transitionend never fires (e.g. interrupted by a
        // rapid prev/next click) - don't leave the close button stuck hidden.
        setTimeout(revealCloseButton, 450);

        requestAnimationFrame(() => {
          // Play: animate back to the natural (Last) state
          dialogImg.style.transition = 'transform .35s ease';
          dialogImg.style.transform = 'none';
        });
      };

      if (dialogImg.decode) {
        dialogImg.decode().then(runFlip, runFlip);
      } else {
        runFlip();
      }
    }

    function closeDialog() {
      // No need to wait for anything here - hide it the instant closing starts.
      closeBtn.hidden = true;
      hideLoader();
      stopWatchingVisibility();
      disarmScrollClose();

      if (reduceMotion || !activeThumb) {
        dialog.close();
        activeThumb = null;
        return;
      }

      const currentRect = dialogImg.getBoundingClientRect();
      const thumbImg = activeThumb.querySelector('img');
      const thumbRect = (thumbImg || activeThumb).getBoundingClientRect();

      dialogImg.style.transformOrigin = 'top left';
      dialogImg.style.transition = 'transform .3s ease';
      dialogImg.style.transform = transformToFit(thumbRect, currentRect);

      const onEnd = () => {
        dialogImg.removeEventListener('transitionend', onEnd);
        dialog.close();
        dialogImg.style.transition = '';
        dialogImg.style.transform = '';
        dialogImg.style.opacity = '';
        activeThumb = null;
      };

      dialogImg.addEventListener('transitionend', onEnd);
    }

    function navigate(step) {
      if (!activeThumb) {
        return;
      }

      const thumbs = getThumbs();

      if (thumbs.length < 2) {
        return;
      }

      const currentIndex = thumbs.indexOf(activeThumb);

      if (currentIndex === -1) {
        return;
      }

      const nextThumb =
        thumbs[(currentIndex + step + thumbs.length) % thumbs.length];

      // Keep the background slider in sync: the thumbnail behind whatever is
      // showing in the dialog should be centered too, so closing the dialog
      // lands the user back where the fullscreen view left off.
      suppressScrollClose();
      nextThumb.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });

      if (reduceMotion) {
        applyGalleryContent(nextThumb);
        return;
      }

      // Force a known, fully-opaque starting point before fading out: a
      // previous navigation interrupted by closing the dialog could otherwise
      // leave opacity stuck at 0, in which case setting it to 0 again below
      // would be a no-op that never fires transitionend, silently breaking
      // every subsequent prev/next click.
      dialogImg.style.transition = 'none';
      dialogImg.style.transform = 'none';
      dialogImg.style.opacity = '1';
      dialogImg.getBoundingClientRect(); // force reflow

      let handled = false;
      const proceed = () => {
        if (handled) {
          return;
        }
        handled = true;
        dialogImg.removeEventListener('transitionend', onFadeOut);
        applyGalleryContent(nextThumb);
        showLoader();

        const fadeIn = () => {
          hideLoader();
          dialogImg.style.transition = 'none';
          dialogImg.style.opacity = '0';
          dialogImg.getBoundingClientRect(); // force reflow
          requestAnimationFrame(() => {
            dialogImg.style.transition = 'opacity .15s ease';
            dialogImg.style.opacity = '1';
          });
        };

        if (dialogImg.decode) {
          dialogImg.decode().then(fadeIn, fadeIn);
        } else {
          fadeIn();
        }
      };

      const onFadeOut = (event) => {
        if (event.target === dialogImg && event.propertyName === 'opacity') {
          proceed();
        }
      };

      dialogImg.addEventListener('transitionend', onFadeOut);
      // Safety net, same idea as the open-flip's close-button reveal: don't
      // get stuck if transitionend doesn't fire for some reason.
      setTimeout(proceed, 250);

      requestAnimationFrame(() => {
        dialogImg.style.transition = 'opacity .15s ease';
        dialogImg.style.opacity = '0';
      });
    }

    const thumbs = getThumbs();

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => openDialog(thumb));
    });

    if (thumbs.length < 2) {
      prevBtn?.setAttribute('hidden', '');
      nextBtn?.setAttribute('hidden', '');
    }

    closeBtn?.addEventListener('click', closeDialog);
    prevBtn?.addEventListener('click', () => navigate(-1));
    nextBtn?.addEventListener('click', () => navigate(1));

    // Tapping the photo itself is a second way to move through a slider (left
    // half = previous, right half = next), same idea as story viewers - the
    // arrows alone are a small target on a phone. A gallery with nothing to
    // page through (see the [hidden] arrows above) has no "next" for a tap to
    // mean, so there the same tap just closes the photo instead.
    dialogImg.addEventListener('click', (event) => {
      if (thumbs.length < 2) {
        closeDialog();
        return;
      }

      const rect = dialogImg.getBoundingClientRect();
      const clickX = event.clientX - rect.left;

      navigate(clickX < rect.width / 2 ? -1 : 1);
    });

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        closeDialog();
      }
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        navigate(-1);
      } else if (event.key === 'ArrowRight') {
        navigate(1);
      }
    });
  }

  function initGalleryDrag(track) {
    let isPointerDown = false;
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;
    let activePointerId = null;

    function findNearestItem() {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let nearest = null;
      let nearestDistance = Infinity;

      track.querySelectorAll('.gallery__item').forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const distance = Math.abs(itemCenter - center);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = item;
        }
      });

      return nearest;
    }

    // Visible prev/next buttons over the edge fades - this slider doesn't
    // loop, so unlike the fullscreen dialog's own (cyclic) arrows, these hide
    // once there's genuinely nothing further in that direction to page to.
    // Driven by the track's own scroll position rather than "nearest item to
    // center": on a wide screen several items are visible at once, so that
    // center item is often nowhere near either actual end.
    function initTrackNav() {
      const prevBtn = track.parentElement.querySelector('[data-track-prev]');
      const nextBtn = track.parentElement.querySelector('[data-track-next]');

      if (!prevBtn && !nextBtn) {
        return;
      }

      function updateNavVisibility() {
        // A couple of pixels of slack for sub-pixel scroll positions.
        const maxScrollLeft = track.scrollWidth - track.clientWidth;

        prevBtn?.toggleAttribute('hidden', track.scrollLeft <= 2);
        nextBtn?.toggleAttribute('hidden', track.scrollLeft >= maxScrollLeft - 2);
      }

      function goTo(direction) {
        track.scrollBy({
          left: direction * track.clientWidth * 0.9,
          behavior: reduceMotion ? 'auto' : 'smooth',
        });
      }

      prevBtn?.addEventListener('click', () => goTo(-1));
      nextBtn?.addEventListener('click', () => goTo(1));

      // Scroll fires continuously while dragging/snapping - a rAF-coalesced
      // update is plenty responsive without recomputing on every pixel.
      let pendingUpdate = null;

      track.addEventListener(
        'scroll',
        () => {
          if (pendingUpdate) {
            return;
          }
          pendingUpdate = requestAnimationFrame(() => {
            pendingUpdate = null;
            updateNavVisibility();
          });
        },
        { passive: true },
      );

      // How many items fit on screen (and so whether there's an end left to
      // reach at all) changes with viewport width.
      window.addEventListener('resize', updateNavVisibility);

      updateNavVisibility();
    }

    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') {
        return;
      }

      isPointerDown = true;
      isDragging = false;
      startX = event.clientX;
      startScrollLeft = track.scrollLeft;
      activePointerId = event.pointerId;
      // Pointer capture is intentionally NOT acquired here: capturing on every
      // pointerdown retargets the eventual mouseup/click to the track, which
      // silently breaks the browser's click synthesis on the button underneath
      // (so a plain click, with no movement, would never open the dialog).
      // We only capture once a real drag is confirmed, in pointermove below.
    });

    track.addEventListener('pointermove', (event) => {
      if (!isPointerDown) {
        return;
      }

      const dx = event.clientX - startX;

      if (!isDragging && Math.abs(dx) > 4) {
        isDragging = true;
        track.classList.add('is-dragging');

        try {
          track.setPointerCapture(activePointerId);
        } catch {
          // ignore - some devices/browsers may not have an active pointer to capture
        }
      }

      if (isDragging) {
        track.scrollLeft = startScrollLeft - dx;
      }
    });

    function endDrag(event) {
      if (!isPointerDown) {
        return;
      }

      isPointerDown = false;

      if (
        event.pointerId !== undefined &&
        track.hasPointerCapture(event.pointerId)
      ) {
        track.releasePointerCapture(event.pointerId);
      }

      if (isDragging) {
        track.classList.remove('is-dragging');
        findNearestItem()?.scrollIntoView({
          inline: 'center',
          block: 'nearest',
          behavior: 'smooth',
        });

        // The click handler below normally clears this, but if the pointer was
        // released outside the track, no click will land here to do it - so
        // clear it shortly after to avoid swallowing an unrelated future click
        // (e.g. a keyboard-triggered activation on a thumbnail).
        setTimeout(() => {
          isDragging = false;
        }, 0);
      }
    }

    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // A click firing right after a drag would open the gallery dialog; swallow it.
    track.addEventListener(
      'click',
      (event) => {
        if (isDragging) {
          event.preventDefault();
          event.stopPropagation();
          isDragging = false;
        }
      },
      true,
    );

    initTrackNav();
  }

  document.querySelectorAll('[data-gallery]').forEach((root) => {
    initGalleryDialog(root);

    const track = root.querySelector('.gallery__track');

    if (track) {
      initGalleryDrag(track);
    }
  });
});
