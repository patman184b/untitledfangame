using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Newtonsoft.Json;
using Fangame.Networking;

namespace Fangame.UI
{
    /// <summary>
    /// Base City View — the main "Home Base" screen showing all buildings,
    /// resource production, gem count, and build queue.
    /// Equivalent to the city/base screen in Rise/RTW mobile titles.
    /// </summary>
    public class BaseCityView : MonoBehaviour
    {
        [Header("Header")]
        public CanvasGroup    mainCanvasGroup; // Added to fade entire HUD when entering
        public TextMeshProUGUI playerNameText;
        public TextMeshProUGUI gemCountText;
        public TextMeshProUGUI woodText;
        public TextMeshProUGUI oreText;
        public TextMeshProUGUI grainText;
        public TextMeshProUGUI powerProductionText;

        [Header("Buildings Grid")]
        public Transform      buildingsContainer;   // Grid layout parent
        public GameObject     buildingCardPrefab;   // Prefab for each building slot

        [Header("Build Queue Banner")]
        public GameObject     buildQueueBanner;
        public TextMeshProUGUI buildQueueLabel;
        public TextMeshProUGUI buildQueueTimerText;

        [Header("Bottom Nav")]
        public Button worldMapButton;
        public Button commandersButton;
        public Button allianceButton;
        public Button leaderboardButton;
        public Button techTreeButton;
        public Button gachaButton;

        private List<BuildingDto> _buildings;
        private BuildingDto       _activeUpgrade;
        private float             _refreshTimer;
        private const float       REFRESH_INTERVAL = 15f;

        private void OnEnable()
        {
            if (mainCanvasGroup != null) StartCoroutine(UITween.FadeIn(mainCanvasGroup, 0.4f));
            RefreshAll();
            UpdateHeader();
        }

        private void Update()
        {
            _refreshTimer += Time.deltaTime;
            if (_refreshTimer >= REFRESH_INTERVAL)
            {
                _refreshTimer = 0;
                RefreshAll();
            }

            // Countdown timer for active build
            if (_activeUpgrade != null && buildQueueBanner.activeSelf)
            {
                var remaining = DateTimeOffset.FromUnixTimeSeconds(_activeUpgrade.finishAt) - DateTimeOffset.UtcNow;
                if (remaining.TotalSeconds > 0)
                    buildQueueTimerText.text = FormatTime(remaining);
                else
                {
                    buildQueueBanner.SetActive(false);
                    _activeUpgrade = null;
                    RefreshAll();
                }
            }
        }

        // ─────────────────────────────────────────────
        // DATA LOADING
        // ─────────────────────────────────────────────

        private void RefreshAll()
        {
            GameSession.Instance.FetchBuildings(OnBuildingsLoaded);
            GameSession.Instance.FetchResources(OnResourcesLoaded);
        }

        private void UpdateHeader()
        {
            playerNameText.text         = GameSession.Instance.PlayerName;
            gemCountText.text           = $"💎 {GameSession.Instance.Gems:N0}";
        }

        private void OnBuildingsLoaded(List<BuildingDto> buildings)
        {
            _buildings = buildings;
            PopulateBuildingsGrid(buildings);

            // Check for active upgrade
            _activeUpgrade = buildings.Find(b => b.isUpgrading);
            if (_activeUpgrade != null)
            {
                buildQueueBanner.SetActive(true);
                buildQueueLabel.text = $"⚒ Upgrading: {_activeUpgrade.name} → Lvl {_activeUpgrade.level + 1}";
            }
            else
            {
                buildQueueBanner.SetActive(false);
            }
        }

        private void OnResourcesLoaded(ResourcesDto resources)
        {
            if (resources?.balance == null) return;
            woodText.text  = $"🪵 {resources.balance.wood:N0}";
            oreText.text   = $"⛏ {resources.balance.ore:N0}";
            grainText.text = $"🌾 {resources.balance.grain:N0}";
            powerProductionText.text = $"⚡ {resources.production?.total_power_production ?? 0:N0}/hr";
            UpdateHeader();
        }

        // ─────────────────────────────────────────────
        // BUILDINGS GRID
        // ─────────────────────────────────────────────

        private void PopulateBuildingsGrid(List<BuildingDto> buildings)
        {
            // Clear existing cards
            foreach (Transform child in buildingsContainer) Destroy(child.gameObject);

            int index = 0;
            foreach (var b in buildings)
            {
                var card = Instantiate(buildingCardPrefab, buildingsContainer);
                var ctrl = card.GetComponent<BuildingCard>();
                if (ctrl != null) ctrl.Bind(b, OnUpgradeRequested);

                // AAA Polish: Cascade animate the building cards sliding/scaling in
                StartCoroutine(StaggeredCardPop(card.GetComponent<RectTransform>(), index * 0.05f));
                index++;
            }
        }

        private System.Collections.IEnumerator StaggeredCardPop(RectTransform cardContent, float delay)
        {
            cardContent.localScale = Vector3.zero;
            yield return new WaitForSeconds(delay);
            yield return UITween.ScaleInBounce(cardContent, 0.4f);
        }

        private void OnUpgradeRequested(BuildingDto building)
        {
            if (building.isUpgrading)
            {
                // TODO: Show speedup dialog (gem cost)
                return;
            }
            GameSession.Instance.UpgradeBuilding(building.key, (json) => RefreshAll());
        }

        // ─────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────

        private static string FormatTime(TimeSpan t)
        {
            if (t.TotalHours >= 1) return $"{(int)t.TotalHours}h {t.Minutes:D2}m";
            if (t.TotalMinutes >= 1) return $"{t.Minutes}m {t.Seconds:D2}s";
            return $"{t.Seconds}s";
        }
    }

    /// <summary>
    /// Individual building card in the city view grid.
    /// </summary>
    public class BuildingCard : MonoBehaviour
    {
        public TextMeshProUGUI nameText;
        public TextMeshProUGUI levelText;
        public TextMeshProUGUI statusText;
        public Button          upgradeButton;
        public Image           progressBar;

        private BuildingDto _building;
        private Action<BuildingDto> _onUpgrade;

        public void Bind(BuildingDto b, Action<BuildingDto> onUpgrade)
        {
            _building  = b;
            _onUpgrade = onUpgrade;

            nameText.text  = b.name;
            levelText.text = $"Lvl {b.level}";

            if (b.isUpgrading)
            {
                statusText.text = $"⚒ Upgrading...";
                upgradeButton.interactable = false;
                if (progressBar != null)
                {
                    float pct = 1f - ((float)b.secondsLeft / Mathf.Max(1, b.secondsLeft + 60));
                    progressBar.fillAmount = pct;
                    progressBar.gameObject.SetActive(true);
                }
            }
            else if (b.level >= b.maxLevel)
            {
                statusText.text = "✅ MAX";
                upgradeButton.interactable = false;
                if (progressBar != null) progressBar.gameObject.SetActive(false);
            }
            else
            {
                statusText.text = $"→ Lvl {b.level + 1}";
                upgradeButton.interactable = true;
                if (progressBar != null) progressBar.gameObject.SetActive(false);
            }

            upgradeButton.onClick.RemoveAllListeners();
            upgradeButton.onClick.AddListener(() => _onUpgrade?.Invoke(_building));
        }
    }
}
