using UnityEngine;
using Fangame.Networking;
using Fangame.Map;

namespace Fangame
{
    public class GameBootstrapper : MonoBehaviour
    {
        public string serverUrl = "http://localhost:3847";
        public HexMapRenderer mapRenderer;

        private ShardApiClient _api;

        private async void Start()
        {
            _api = new ShardApiClient(serverUrl);
            
            try 
            {
                Debug.Log("Syncing with Shard...");
                var shard = await _api.GetShardAsync();
                
                if (shard.tiles == null || shard.tiles.Count == 0)
                {
                    Debug.Log("World is empty, generating...");
                    await _api.GenerateMapAsync();
                    shard = await _api.GetShardAsync();
                }

                mapRenderer.RenderMap(shard.tiles);
                Debug.Log($"Synchronized Day {shard.season_day} of Shard {shard.id}");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to connect to shard: {e.Message}");
            }
        }
    }
}
