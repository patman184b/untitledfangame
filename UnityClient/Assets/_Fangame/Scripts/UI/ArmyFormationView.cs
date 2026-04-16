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
    /// UI for assigning training units to a commander's 3 slots.
    /// Pulls from player's unit inventory.
    /// </summary>
    public class ArmyFormationView : MonoBehaviour
    {
        [Header("UI References")]
        public GameObject panelRoot;
        public TextMeshProUGUI commanderNameText;

        [Header("Slots")]
        public TMP_Dropdown[] slotUnitDropdowns;
        public TMP_InputField[] slotCountInputs;

        [Header("Inventory")]
        public TextMeshProUGUI inventorySummaryText;

        private string _activeCommanderId;
        private List<InventoryItemDto> _inventory;

        public void Open(string commanderId)
        {
            _activeCommanderId = commanderId;
            commanderNameText.text = $"Army Setup: {commanderId}";
            panelRoot.SetActive(true);
            LoadInventory();
        }

        private void LoadInventory()
        {
            StartCoroutine(GameSession.Instance.Get("/api/inventory", (json, err) => {
                if (err != null) return;
                _inventory = JsonConvert.DeserializeObject<List<InventoryItemDto>>(json);
                PopulateDropdowns();
                UpdateInventorySummary();
            }));
        }

        private void PopulateDropdowns()
        {
            foreach (var dropdown in slotUnitDropdowns)
            {
                dropdown.ClearOptions();
                dropdown.options.Add(new TMP_Dropdown.OptionData("Empty"));
                foreach (var item in _inventory)
                {
                    if (item.count > 0)
                        dropdown.options.Add(new TMP_Dropdown.OptionData($"{item.unit_id} ({item.count})"));
                }
                dropdown.RefreshShownValue();
            }
        }

        private void UpdateInventorySummary()
        {
            string s = "Stashed Units: ";
            foreach (var item in _inventory) s += $"{item.unit_id}:{item.count}  ";
            inventorySummaryText.text = s;
        }

        public void OnSaveClicked()
        {
            var slots = new List<object>();
            for (int i = 0; i < 3; i++)
            {
                int ddVal = slotUnitDropdowns[i].value;
                if (ddVal == 0) continue; // Skip empty

                string unitId = _inventory[ddVal - 1].unit_id;
                int count = int.Parse(slotCountInputs[i].text);
                slots.Add(new { slotIndex = i + 1, unitId = unitId, count = count });
            }

            var payload = new { commanderId = _activeCommanderId, slots = slots };
            string body = JsonConvert.SerializeObject(payload);

            StartCoroutine(GameSession.Instance.Post("/api/formation/update", body, null, (json, err) => {
                if (err != null) { Debug.LogError("Update failed: " + err); return; }
                Debug.Log("Army updated!");
                panelRoot.SetActive(false);
            }));
        }

        public void Close() => panelRoot.SetActive(false);
    }

    [Serializable]
    public class InventoryItemDto
    {
        public string player_id;
        public string unit_id;
        public int count;
    }
}
