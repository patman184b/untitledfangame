using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Fangame.Networking;

namespace Fangame.UI
{
    /// <summary>
    /// Gacha / Mathom Hall pull screen.
    /// Shows pity counter, pull animation, and reward reveal.
    /// </summary>
    public class GachaView : MonoBehaviour
    {
        [Header("UI")]
        public Button             pullButton;
        public TextMeshProUGUI    pullButtonLabel;
        public TextMeshProUGUI    pityText;          // "Pity: 23 / 50"
        public GameObject         loadingSpinner;

        [Header("Result Panel")]
        public GameObject         resultPanel;
        public CanvasGroup        resultCanvasGroup; // Added for fading
        public TextMeshProUGUI    resultItemText;
        public TextMeshProUGUI    resultRarityText;
        public Image              resultCardGlow;    // Gold glow for high-tier
        public Button             closeResultButton;

        [Header("Hi-Def AAA Effects")]
        public ParticleSystem     legendaryParticles;
        public Gacha3DModelViewer modelViewer; // Renders 3D avatar


        [Header("Colors")]
        public Color normalColor  = Color.white;
        public Color epicColor    = new Color(0.6f, 0.3f, 1f);
        public Color legendaryColor = new Color(1f, 0.7f, 0.1f);

        private int  _pity;
        private bool _pulling;

        private void OnEnable()
        {
            pullButton.onClick.AddListener(OnPullClicked);
            closeResultButton.onClick.AddListener(() => resultPanel.SetActive(false));
            resultPanel.SetActive(false);
            RefreshPity();
        }

        private void RefreshPity()
        {
            StartCoroutine(GameSession.Instance.Get("/api/gacha/pity", (json, err) =>
            {
                if (json == null) return;
                var dto = Newtonsoft.Json.JsonConvert.DeserializeObject<PityDto>(json);
                _pity = dto?.pityCounter ?? 0;
                pityText.text = $"Pity: {_pity} / 50";
                pullButtonLabel.text = _pity >= 45 ? $"🌟 PULL — Guaranteed soon!" : "✦ Draw";
            }));
        }

        private void OnPullClicked()
        {
            if (_pulling) return;
            _pulling = true;
            pullButton.interactable = false;
            loadingSpinner.SetActive(true);

            GameSession.Instance.GachaPull((result) =>
            {
                _pulling = false;
                pullButton.interactable = true;
                loadingSpinner.SetActive(false);

                if (result == null) return;

                _pity = result.pityCounter;
                pityText.text = $"Pity: {_pity} / 50";

                ShowResult(result.item);
            });
        }

        private void ShowResult(string item)
        {
            resultPanel.SetActive(true);
            resultItemText.text = FormatItemName(item);

            bool isHighTier = item.StartsWith("commander_") || item.StartsWith("gear_dwarven");

            if (isHighTier)
            {
                resultRarityText.text  = item.StartsWith("commander_") ? "⚔ COMMANDER UNLOCKED!" : "✦ LEGENDARY GEAR";
                resultCardGlow.color   = legendaryColor;
                resultRarityText.color = legendaryColor;

                // AAA Polish: Spawn 3D particles and start glowing
                if (legendaryParticles != null) legendaryParticles.Play();
                StartCoroutine(UITween.PingPongGlow(resultCardGlow, legendaryColor, 3f));
            }
            else if (item.Contains("epic"))
            {
                resultRarityText.text  = "★ EPIC";
                resultCardGlow.color   = epicColor;
                resultRarityText.color = epicColor;
            }
            else
            {
                resultRarityText.text  = "Common";
                resultCardGlow.color   = normalColor;
                resultRarityText.color = normalColor;
            }

            // AAA Polish: Animate the Result Panel IN
            if (resultCanvasGroup != null) StartCoroutine(UITween.FadeIn(resultCanvasGroup, 0.3f));
            StartCoroutine(UITween.ScaleInBounce(resultPanel.GetComponent<RectTransform>(), 0.5f));
            
            // AAA Polish: Tell the 3D Model viewer to display the corresponding 3D prefab
            // (Assuming there is logic to map string 'item' to a Resources.Load prefab)
            if (modelViewer != null)
            {
                // Example: GameObject prefab = Resources.Load<GameObject>($"3DModels/Characters/{item}");
                // modelViewer.DisplayCharacter(prefab);
            }
        }

        private static string FormatItemName(string raw)
        {
            // Convert snake_case ID to Title Case display name
            return System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(
                raw.Replace("_", " ")
            );
        }

        [Serializable] private class PityDto
        {
            public int pityCounter;
            public int pityAt;
        }
    }
}
