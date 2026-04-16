using System;
using System.Collections;
using UnityEngine;

namespace Fangame.UI
{
    /// <summary>
    /// Lightweight tweening engine to provide "Hi-Def" UI animations (scale, fade, move)
    /// without strict dependencies on DOTween. Can be safely upgraded to DOTween later.
    /// </summary>
    public static class UITween
    {
        public static IEnumerator ScaleInBounce(RectTransform target, float duration = 0.3f)
        {
            float elapsed = 0f;
            target.localScale = Vector3.zero;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                
                // Simple easeOutBack math
                float s = 1.70158f;
                float easedT = --t * t * ((s + 1) * t + s) + 1;
                
                target.localScale = Vector3.one * easedT;
                yield return null;
            }
            target.localScale = Vector3.one;
        }

        public static IEnumerator FadeIn(CanvasGroup group, float duration = 0.2f)
        {
            float elapsed = 0f;
            group.alpha = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                group.alpha = Mathf.Lerp(0f, 1f, elapsed / duration);
                yield return null;
            }
            group.alpha = 1f;
        }

        public static IEnumerator PingPongGlow(UnityEngine.UI.Image image, Color glowColor, float speed = 1f)
        {
            Color baseColor = image.color;
            while (true)
            {
                float t = (Mathf.Sin(Time.time * speed) + 1f) / 2f;
                image.color = Color.Lerp(baseColor, glowColor, t);
                yield return null;
            }
        }
    }
}
