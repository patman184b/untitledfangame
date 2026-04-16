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
    /// Technology Research screen.
    /// Shows all 3 branches (Military / Economy / Fortification) as scrollable lists.
    /// </summary>
    public class TechTreeView : MonoBehaviour
    {
        [Header("Branch Tabs")]
        public Button militaryTab;
        public Button economyTab;
        public Button fortificationTab;

        [Header("Tech List")]
        public Transform       techListContainer;
        public GameObject      techRowPrefab;

        [Header("Detail Panel")]
        public GameObject          detailPanel;
        public TextMeshProUGUI     detailNameText;
        public TextMeshProUGUI     detailDescText;
        public TextMeshProUGUI     detailCostText;
        public TextMeshProUGUI     detailReqText;
        public TextMeshProUGUI     detailTimeText;
        public Button              researchButton;
        public TextMeshProUGUI     researchButtonLabel;

        private string                       _currentBranch = "military";
        private Dictionary<string, TechDef>  _techTree;
        private List<string>                 _researched = new();
        private string                       _selectedTech;

        private void OnEnable()
        {
            militaryTab.onClick.AddListener(()     => SwitchBranch("military"));
            economyTab.onClick.AddListener(()      => SwitchBranch("economy"));
            fortificationTab.onClick.AddListener(()=> SwitchBranch("fortification"));

            LoadData();
            detailPanel.SetActive(false);
        }

        private void LoadData()
        {
            GameSession.Instance.FetchTechTree((json) =>
            {
                _techTree = JsonConvert.DeserializeObject<Dictionary<string, TechDef>>(json);
                GameSession.Instance.StartCoroutine(GameSession.Instance.Get("/api/tech/player", (json2, err) =>
                {
                    if (json2 != null)
                    {
                        var res = JsonConvert.DeserializeObject<PlayerTechsResponse>(json2);
                        _researched = new List<string>();
                        if (res?.researched != null)
                            foreach (var t in res.researched)
                                if (t.completed_at > 0) _researched.Add(t.tech_key);
                    }
                    RenderBranch(_currentBranch);
                }));
            });
        }

        private void SwitchBranch(string branch)
        {
            _currentBranch = branch;
            RenderBranch(branch);
            detailPanel.SetActive(false);
        }

        private void RenderBranch(string branch)
        {
            if (_techTree == null) return;
            foreach (Transform c in techListContainer) Destroy(c.gameObject);

            foreach (var (key, def) in _techTree)
            {
                if (def.branch != branch) continue;
                var row = Instantiate(techRowPrefab, techListContainer);
                var ctrl = row.GetComponent<TechRow>();
                if (ctrl == null) continue;

                bool done    = _researched.Contains(key);
                bool prereqsMet = true;
                if (def.requires != null)
                    foreach (var r in def.requires)
                        if (!_researched.Contains(r)) { prereqsMet = false; break; }

                ctrl.Bind(key, def, done, prereqsMet, OnTechSelected);
            }
        }

        private void OnTechSelected(string key)
        {
            _selectedTech = key;
            if (!_techTree.TryGetValue(key, out var def)) return;

            detailPanel.SetActive(true);
            detailNameText.text = def.name;
            detailDescText.text = def.description;
            detailCostText.text = $"🪵{def.cost?.wood ?? 0}  ⛏{def.cost?.ore ?? 0}  🌾{def.cost?.grain ?? 0}";
            detailTimeText.text = $"⏱ {FormatTime(def.researchTimeSec)}";

            bool done = _researched.Contains(key);
            bool prereqsMet = true;
            if (def.requires != null)
                foreach (var r in def.requires)
                    if (!_researched.Contains(r)) { prereqsMet = false; break; }

            if (def.requires?.Count > 0)
            {
                var names = new System.Text.StringBuilder("Requires: ");
                foreach (var r in def.requires) names.Append(_techTree.TryGetValue(r, out var rd) ? rd.name : r).Append(", ");
                detailReqText.text = names.ToString().TrimEnd(',', ' ');
            }
            else detailReqText.text = "No prerequisites.";

            if (done)
            {
                researchButtonLabel.text = "✅ Researched";
                researchButton.interactable = false;
            }
            else if (!prereqsMet)
            {
                researchButtonLabel.text = "🔒 Prerequisites Not Met";
                researchButton.interactable = false;
            }
            else
            {
                researchButtonLabel.text = "Begin Research";
                researchButton.interactable = true;
                researchButton.onClick.RemoveAllListeners();
                researchButton.onClick.AddListener(() => OnResearchClicked(key));
            }
        }

        private void OnResearchClicked(string key)
        {
            researchButton.interactable = false;
            GameSession.Instance.StartResearch(key, (_) => LoadData());
        }

        private static string FormatTime(int seconds)
        {
            var t = TimeSpan.FromSeconds(seconds);
            if (t.TotalHours >= 1) return $"{(int)t.TotalHours}h {t.Minutes}m";
            if (t.TotalMinutes >= 1) return $"{t.Minutes}m";
            return $"{t.Seconds}s";
        }
    }

    // ─── Supporting Component ────────────────────────────────────

    public class TechRow : MonoBehaviour
    {
        public TextMeshProUGUI nameText;
        public TextMeshProUGUI tierText;
        public Image           statusIcon;
        public Color           doneColor     = Color.green;
        public Color           availColor    = Color.white;
        public Color           lockedColor   = new Color(0.4f, 0.4f, 0.4f);

        public void Bind(string key, TechDef def, bool done, bool prereqsMet, Action<string> onSelect)
        {
            nameText.text = def.name;
            tierText.text = $"Tier {def.tier}";
            if (statusIcon != null)
                statusIcon.color = done ? doneColor : prereqsMet ? availColor : lockedColor;

            GetComponent<Button>()?.onClick.AddListener(() => onSelect(key));
        }
    }

    // ─── Data Models ─────────────────────────────────────────────

    [Serializable] public class TechDef
    {
        public string       name;
        public string       branch;
        public string       description;
        public int          tier;
        public List<string> requires;
        public int          academyRequired;
        public TechCost     cost;
        public int          researchTimeSec;
    }

    [Serializable] public class TechCost
    {
        public int wood;
        public int ore;
        public int grain;
    }

    [Serializable] public class PlayerTechEntry
    {
        public string tech_key;
        public long   completed_at;
    }

    [Serializable] public class PlayerTechsResponse
    {
        public List<PlayerTechEntry> researched;
    }
}
