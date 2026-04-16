using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Fangame.UI
{
    public class SiegeHPBar : MonoBehaviour
    {
        public Slider hpSlider;
        public TextMeshProUGUI hpText;
        public CanvasGroup canvasGroup;

        private void Start()
        {
            if (canvasGroup != null) canvasGroup.alpha = 1f;
        }

        public void UpdateData(int current, int max, string label)
        {
            if (hpSlider != null)
            {
                hpSlider.maxValue = max;
                hpSlider.value = current;
            }

            if (hpText != null)
            {
                hpText.text = $"{label}: {current}/{max}";
            }

            // Simple fading logic: show bar only if damaged
            if (canvasGroup != null)
            {
                canvasGroup.alpha = (current < max) ? 1f : 0.4f;
            }
        }

        private void Update()
        {
            // Always face camera
            if (Camera.main != null)
            {
                transform.LookAt(transform.position + Camera.main.transform.rotation * Vector3.forward,
                                 Camera.main.transform.rotation * Vector3.up);
            }
        }
    }
}
