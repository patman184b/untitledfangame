using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Fangame.Networking;
using System.Collections.Generic;

namespace Fangame.Map
{
    /// <summary>
    /// Popup UI that appears when clicking a tile on the world map.
    /// Handles action triggering (March, Capture, etc).
    /// </summary>
    public class TileInspectorPanel : MonoBehaviour
    {
        [Header("UI Elements")]
        public GameObject panelRoot;
        public TextMeshProUGUI titleText;
        public TextMeshProUGUI coordsText;
        public TextMeshProUGUI ownerText;
        public TextMeshProUGUI siegeHpText;
        public Slider siegeHpSlider;

        [Header("Buttons")]
        public Button marchButton;
        public Button rallyButton;
        public Button viewProfileButton;

        [Header("March Queue Panel")]
        public MarchQueuePanel marchQueuePanel;

        private TileDto _currentTile;

        private void Start()
        {
            panelRoot.SetActive(false);
            marchButton.onClick.AddListener(OnMarchClicked);
            rallyButton.onClick.AddListener(OnRallyClicked);
        }

        public void ShowTile(TileDto tile)
        {
            _currentTile = tile;
            panelRoot.SetActive(true);

            titleText.text = GetTileTitle(tile);
            coordsText.text = $"({tile.X}, {tile.Y})";
            ownerText.text = string.IsNullOrEmpty(tile.OwnerId) ? "Neutral" : $"Owner: {tile.OwnerId}";

            if (tile.MaxSiegeHp > 0)
            {
                siegeHpText.gameObject.SetActive(true);
                siegeHpSlider.gameObject.SetActive(true);
                siegeHpText.text = $"Siege: {tile.SiegeHp} / {tile.MaxSiegeHp}";
                siegeHpSlider.value = (float)tile.SiegeHp / tile.MaxSiegeHp;
            }
            else
            {
                siegeHpText.gameObject.SetActive(false);
                siegeHpSlider.gameObject.SetActive(false);
            }

            // Disable buttons based on ownership?
            bool isOwn = tile.OwnerId == GameSession.Instance.PlayerId;
            marchButton.interactable = !isOwn; 
            rallyButton.interactable = !isOwn;
        }

        private string GetTileTitle(TileDto tile)
        {
            if (!string.IsNullOrEmpty(tile.StructureId)) return tile.StructureId;
            return tile.Terrain switch {
                "Gg" => "Plain",
                "Ww" => "Water",
                "Mm" => "Mountain",
                "Hh" => "Hill",
                _ => "Wilderness"
            } + $" Lvl {tile.Level}";
        }

        private void OnMarchClicked()
        {
            marchQueuePanel.Open(_currentTile.X, _currentTile.Y);
            panelRoot.SetActive(false);
        }

        private void OnRallyClicked()
        {
            // Logic for rally would go here
            Debug.Log($"Initiating Rally on ({_currentTile.X}, {_currentTile.Y})");
        }

        public void Close()
        {
            panelRoot.SetActive(false);
        }
    }
}
