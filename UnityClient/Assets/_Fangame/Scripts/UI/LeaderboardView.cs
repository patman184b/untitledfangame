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
    /// Leaderboard screen — tabbed Global / Weekly / Alliance rankings.
    /// </summary>
    public class LeaderboardView : MonoBehaviour
    {
        [Header("Tabs")]
        public Button globalTab;
        public Button weeklyTab;
        public Button allianceTab;

        [Header("Content")]
        public Transform    rowContainer;
        public GameObject   playerRowPrefab;
        public GameObject   allianceRowPrefab;
        public TextMeshProUGUI  sectionTitle;

        [Header("My Rank")]
        public TextMeshProUGUI myRankText;
        public TextMeshProUGUI myMeritText;

        private string _currentTab = "global";

        private void OnEnable()
        {
            globalTab.onClick.AddListener(()   => LoadTab("global"));
            weeklyTab.onClick.AddListener(()   => LoadTab("weekly"));
            allianceTab.onClick.AddListener(() => LoadTab("alliance"));
            LoadTab("global");
        }

        private void LoadTab(string tab)
        {
            _currentTab = tab;
            foreach (Transform c in rowContainer) Destroy(c.gameObject);

            sectionTitle.text = tab == "global"   ? "🌍 Global Rankings (All-Time)" :
                                tab == "weekly"   ? "📅 Weekly Rankings"             :
                                                    "🏰 Alliance Power Rankings";

            GameSession.Instance.FetchLeaderboard(tab, (json) =>
            {
                if (tab == "alliance") RenderAllianceRows(json);
                else                  RenderPlayerRows(json, tab);
            });
        }

        private void RenderPlayerRows(string json, string tab)
        {
            var entries = JsonConvert.DeserializeObject<List<LeaderboardEntry>>(json);
            if (entries == null) return;

            int myRank = -1;
            for (int i = 0; i < entries.Count; i++)
            {
                var e   = entries[i];
                var row = Instantiate(playerRowPrefab, rowContainer);
                var txt = row.GetComponentsInChildren<TextMeshProUGUI>();
                if (txt.Length >= 3)
                {
                    txt[0].text = $"#{i + 1}";
                    txt[1].text = e.display_name;
                    txt[2].text = $"{(tab == "weekly" ? e.weekly_merit : e.total_merit):N0}  ★";
                }

                // Highlight own entry
                if (e.id == GameSession.Instance.PlayerId)
                {
                    myRank = i + 1;
                    myMeritText.text = $"{(tab == "weekly" ? e.weekly_merit : e.total_merit):N0} Merit";
                    var img = row.GetComponent<Image>();
                    if (img != null) img.color = new Color(1f, 0.9f, 0.3f, 0.3f);
                }
            }

            myRankText.text = myRank > 0 ? $"Your Rank: #{myRank}" : "Unranked";
        }

        private void RenderAllianceRows(string json)
        {
            var entries = JsonConvert.DeserializeObject<List<AllianceLeaderEntry>>(json);
            if (entries == null) return;

            for (int i = 0; i < entries.Count; i++)
            {
                var e   = entries[i];
                var row = Instantiate(allianceRowPrefab ?? playerRowPrefab, rowContainer);
                var txt = row.GetComponentsInChildren<TextMeshProUGUI>();
                if (txt.Length >= 3)
                {
                    txt[0].text = $"#{i + 1}";
                    txt[1].text = $"{e.name}  ({e.member_count} members)";
                    txt[2].text = $"{e.total_contribution:N0}  pts";
                }
            }
            myRankText.text  = "";
            myMeritText.text = "";
        }
    }

    // ─── DTOs ────────────────────────────────────────────────────

    [Serializable] public class LeaderboardEntry
    {
        public string id;
        public string display_name;
        public int    total_merit;
        public int    weekly_merit;
        public int    base_level;
        public string faction_id;
    }

    [Serializable] public class AllianceLeaderEntry
    {
        public string id;
        public string name;
        public string color_hex;
        public int    total_contribution;
        public int    member_count;
    }
}
