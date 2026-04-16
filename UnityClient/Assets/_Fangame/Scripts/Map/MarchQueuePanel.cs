using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Fangame.Networking;
using System.Collections.Generic;
using Newtonsoft.Json;
using System;

namespace Fangame.Map
{
    /// <summary>
    /// UI panel to configure a march: pick commander and sliding troop count.
    /// Deducts Grain in the backend.
    /// </summary>
    public class MarchQueuePanel : MonoBehaviour
    {
        [Header("UI Elements")]
        public GameObject panelRoot;
        public TMP_Dropdown commanderDropdown;
        public Slider troopSlider;
        public TextMeshProUGUI troopText;
        public TextMeshProUGUI costText;
        public Button launchButton;

        private int _targetX;
        private int _targetY;
        private List<CommanderRespectDto> _commanders;

        private void Start()
        {
            panelRoot.SetActive(false);
            troopSlider.onValueChanged.AddListener(OnTroopSliderChanged);
            launchButton.onClick.AddListener(OnLaunchClicked);
        }

        public void Open(int x, int y)
        {
            _targetX = x;
            _targetY = y;
            panelRoot.SetActive(true);
            LoadCommanders();
        }

        private void LoadCommanders()
        {
            StartCoroutine(GameSession.Instance.Get("/api/commanders/player", (json, err) => {
                if (err != null) return;
                _commanders = JsonConvert.DeserializeObject<List<CommanderRespectDto>>(json);
                _commanders = _commanders.FindAll(c => c.is_unlocked == 1);
                
                commanderDropdown.ClearOptions();
                foreach(var c in _commanders)
                {
                    commanderDropdown.options.Add(new TMP_Dropdown.OptionData(c.commander_id));
                }
                commanderDropdown.RefreshShownValue();
            }));
        }

        private void OnTroopSliderChanged(float val)
        {
            int troops = (int)val * 100;
            troopText.text = $"Troops: {troops}";
            costText.text = $"Grain Cost: {troops / 20}"; // Simplified client-side preview
        }

        private void OnLaunchClicked()
        {
            if (_commanders == null || _commanders.Count == 0) return;

            string cmdId = _commanders[commanderDropdown.value].commander_id;
            int troops = (int)troopSlider.value * 100;

            var payload = new {
                commanderId = cmdId,
                toX = _targetX,
                toY = _targetY,
                troops = troops
            };

            string body = JsonConvert.SerializeObject(payload);
            StartCoroutine(GameSession.Instance.Post("/api/marches/queue", body, null, (json, err) => {
                if (err != null) { Debug.LogError("March failed: " + err); return; }
                Debug.Log("March queued successfully!");
                panelRoot.SetActive(false);
                WorldMapController.Instance.FetchMap(); // Refresh
            }));
        }

        public void Close()
        {
            panelRoot.SetActive(false);
        }
    }

    [Serializable]
    public class CommanderRespectDto
    {
        public string commander_id;
        public int respect_points;
        public int is_unlocked;
    }
}
