using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using Fangame.Networking;
using Newtonsoft.Json;
using System;

namespace Fangame.UI
{
    /// <summary>
    /// UI for training units (Infantry, Cavalry, Ranged).
    /// Fetches unit definitions from /api/units and shows training queue.
    /// </summary>
    public class ArmyRecruitmentView : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject panelRoot;
        public Transform unitContainer;
        public GameObject unitCardPrefab;
        public TextMeshProUGUI queueSummaryText;

        [Header("Selection Detail")]
        public GameObject detailPanel;
        public TextMeshProUGUI detailName;
        public Slider countSlider;
        public TextMeshProUGUI countText;
        public TextMeshProUGUI costText;
        public Button recruitButton;

        private List<UnitDefDto> _unitDefs;
        private UnitDefDto _selectedUnit;

        private void Start()
        {
            panelRoot.SetActive(false);
            detailPanel.SetActive(false);
            countSlider.onValueChanged.AddListener(OnSliderChanged);
            recruitButton.onClick.AddListener(OnRecruitClicked);
        }

        public void Open()
        {
            panelRoot.SetActive(true);
            LoadUnits();
        }

        private void LoadUnits()
        {
            StartCoroutine(GameSession.Instance.Get("/api/units", (json, err) => {
                if (err != null) return;
                _unitDefs = JsonConvert.DeserializeObject<List<UnitDefDto>>(json);
                RefreshUnitCards();
            }));
        }

        private void RefreshUnitCards()
        {
            foreach (Transform t in unitContainer) Destroy(t.gameObject);
            foreach (var unit in _unitDefs)
            {
                var card = Instantiate(unitCardPrefab, unitContainer);
                card.GetComponentInChildren<TextMeshProUGUI>().text = unit.name;
                card.GetComponent<Button>().onClick.AddListener(() => OnUnitSelected(unit));
            }
        }

        private void OnUnitSelected(UnitDefDto unit)
        {
            _selectedUnit = unit;
            detailPanel.SetActive(true);
            detailName.text = unit.name;
            countSlider.maxValue = 1000; // Max batch
            countSlider.value = 100;
            OnSliderChanged(100);
        }

        private void OnSliderChanged(float val)
        {
            int count = (int)val;
            countText.text = $"Quantity: {count}";
            
            if (_selectedUnit != null && _selectedUnit.cost != null)
            {
                costText.text = $"Cost: {(_selectedUnit.cost.wood * count)} Wood, {(_selectedUnit.cost.ore * count)} Ore";
            }
        }

        private void OnRecruitClicked()
        {
            if (_selectedUnit == null) return;

            var payload = new { unitId = _selectedUnit.id, count = (int)countSlider.value };
            string body = JsonConvert.SerializeObject(payload);

            StartCoroutine(GameSession.Instance.Post("/api/recruit", body, null, (json, err) => {
                if (err != null) { Debug.LogError("Training failed: " + err); return; }
                Debug.Log("Training started!");
                detailPanel.SetActive(false);
            }));
        }

        public void Close() => panelRoot.SetActive(false);
    }

    [Serializable]
    public class UnitDefDto
    {
        public string id;
        public string name;
        public string type;
        public UnitCostDto cost;
        public int trainingTimeSec;
    }

    [Serializable]
    public class UnitCostDto
    {
        public int wood;
        public int ore;
        public int grain;
        public int stone;
    }
}
