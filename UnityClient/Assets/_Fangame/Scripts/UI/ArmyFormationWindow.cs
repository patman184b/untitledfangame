using UnityEngine;
using UnityEngine.UI;
using System.Collections.Generic;
using Fangame.Networking;
using TMPro;

namespace Fangame.UI
{
    public class ArmyFormationWindow : MonoBehaviour
    {
        [Header("UI Slots")]
        public Image[] slotImages; // Visuals for the 3 slots
        public TMP_InputField[] countInputs; 
        public TMP_Dropdown[] unitDropdowns;

        [Header("Commander Info")]
        public TextMeshProUGUI commanderNameText;

        private string _activeCommanderId;
        private ShardApiClient _api;
        private List<InventoryItemDto> _userInventory;

        public async void Open(string commanderId, ShardApiClient api)
        {
            _activeCommanderId = commanderId;
            _api = api;
            commanderNameText.text = $"Commander: {commanderId}";

            // Fetch current inventory to populate dropdowns
            _userInventory = await _api.GetInventoryAsync("player_1");
            PopulateDropdowns();
            gameObject.SetActive(true);
        }

        private void PopulateDropdowns()
        {
            foreach (var dropdown in unitDropdowns)
            {
                dropdown.ClearOptions();
                List<string> options = new List<string>();
                foreach (var item in _userInventory) options.Add(item.unit_id);
                dropdown.AddOptions(options);
            }
        }

        public async void SaveFormations()
        {
            var slots = new List<FormationSlotDto>();
            for (int i = 0; i < 3; i++)
            {
                slots.Add(new FormationSlotDto
                {
                    slotIndex = i + 1,
                    unitId = unitDropdowns[i].options[unitDropdowns[i].value].text,
                    count = int.Parse(countInputs[i].text)
                });
            }

            try 
            {
                await _api.UpdateFormationAsync(_activeCommanderId, "player_1", slots);
                Debug.Log("Formations updated successfully!");
                gameObject.SetActive(false);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to update formation: {e.Message}");
            }
        }
    }

    [System.Serializable]
    public class FormationSlotDto
    {
        public int slotIndex;
        public string unitId;
        public int count;
    }
}
