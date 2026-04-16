using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using Fangame.Networking;
using TMPro;

namespace Fangame.UI
{
    public class RecruitmentWindow : MonoBehaviour
    {
        [Header("UI References")]
        public Transform unitListContainer;
        public GameObject unitItemPrefab;
        public Button recruitButton;
        public Slider amountSlider;
        public TextMeshProUGUI totalCostText;

        private List<UnitDto> _availableUnits;
        private UnitDto _selectedUnit;
        private ShardApiClient _api;

        public void Initialize(ShardApiClient api)
        {
            _api = api;
            LoadUnits();
        }

        private async void LoadUnits()
        {
            _availableUnits = await _api.GetUnitsAsync();
            PopulateList();
        }

        private void PopulateList()
        {
            foreach (Transform child in unitListContainer) Destroy(child.gameObject);

            foreach (var unit in _availableUnits)
            {
                var item = Instantiate(unitItemPrefab, unitListContainer);
                item.GetComponentInChildren<TextMeshProUGUI>().text = unit.name;
                item.GetComponent<Button>().onClick.AddListener(() => SelectUnit(unit));
            }
        }

        private void SelectUnit(UnitDto unit)
        {
            _selectedUnit = unit;
            UpdateCostDisplay();
        }

        public void OnAmountChanged()
        {
            UpdateCostDisplay();
        }

        private void UpdateCostDisplay()
        {
            if (_selectedUnit == null) return;
            int count = (int)amountSlider.value;
            var c = _selectedUnit.cost;
            totalCostText.text = $"Cost: {c.grain * count} G, {c.wood * count} W, {c.ore * count} O, {c.gold * count} Au";
        }

        public async void RequestRecruitment()
        {
            if (_selectedUnit == null) return;
            
            recruitButton.interactable = false;
            try 
            {
                await _api.RecruitAsync("player_1", _selectedUnit.id, (int)amountSlider.value);
                Debug.Log("Recruitment started!");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Training failed: {e.Message}");
            }
            recruitButton.interactable = true;
        }
    }
}
