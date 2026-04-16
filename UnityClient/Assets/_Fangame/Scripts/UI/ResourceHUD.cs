using UnityEngine;
using TMPro;
using System.Collections;
using System.Collections.Generic;
using Fangame.Networking;
using Newtonsoft.Json;

namespace Fangame.UI
{
    /// <summary>
    /// Top-level HUD bar showing wood, ore, grain, stone, and gems.
    /// Periodically refreshes from the server.
    /// </summary>
    public class ResourceHUD : MonoBehaviour
    {
        public TextMeshProUGUI woodText;
        public TextMeshProUGUI oreText;
        public TextMeshProUGUI grainText;
        public TextMeshProUGUI stoneText;
        public TextMeshProUGUI gemsText;

        private void Start()
        {
            StartCoroutine(RefreshLoop());
        }

        private IEnumerator RefreshLoop()
        {
            while (true)
            {
                Refresh();
                yield return new WaitForSeconds(5f);
            }
        }

        private void Refresh()
        {
            if (!GameSession.Instance.IsLoggedIn) return;

            StartCoroutine(GameSession.Instance.Get("/api/resources", (json, err) => {
                if (err != null) return;
                var data = JsonConvert.DeserializeObject<ResourceResponse>(json);
                UpdateUI(data.balance);
            }));
        }

        private void UpdateUI(ResourceBalance bal)
        {
            woodText.text  = bal.wood.ToString("N0");
            oreText.text   = bal.ore.ToString("N0");
            grainText.text = bal.grain.ToString("N0");
            stoneText.text = bal.stone.ToString("N0");
            
            // Also update total gems from profile or base data
            // (Assuming gems are in the profile response for now)
        }
    }

    public class ResourceResponse {
        public ResourceBalance balance;
    }

    public class ResourceBalance {
        public int wood;
        public int ore;
        public int grain;
        public int stone;
    }
}
