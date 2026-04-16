using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Fangame.Networking
{
    /// <summary>
    /// Minimal WebSocket client: receives JSON and forwards to main thread via queue.
    /// </summary>
    public class ShardWebSocketClient : MonoBehaviour
    {
        readonly ConcurrentQueue<string> _messages = new();
        ClientWebSocket _socket;
        CancellationTokenSource _cts;
        Uri _uri;

        public bool IsConnected => _socket != null && _socket.State == WebSocketState.Open;

        public event Action<string> OnTextMessage;

        public void Connect(string wsUrl)
        {
            Disconnect();
            _uri = new Uri(wsUrl);
            _cts = new CancellationTokenSource();
            _ = RunAsync(_cts.Token);
        }

        public void Disconnect()
        {
            try
            {
                _cts?.Cancel();
                _socket?.Abort();
                _socket?.Dispose();
            }
            catch { /* ignore */ }
            _socket = null;
            _cts = null;
        }

        void OnDestroy() => Disconnect();

        void Update()
        {
            while (_messages.TryDequeue(out var msg))
                OnTextMessage?.Invoke(msg);
        }

        async Task RunAsync(CancellationToken token)
        {
            try
            {
                _socket = new ClientWebSocket();
                await _socket.ConnectAsync(_uri, token).ConfigureAwait(false);
                var buffer = new byte[1024 * 256];
                while (!token.IsCancellationRequested && _socket.State == WebSocketState.Open)
                {
                    var sb = new StringBuilder();
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await _socket.ReceiveAsync(new ArraySegment<byte>(buffer), token).ConfigureAwait(false);
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await _socket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, token).ConfigureAwait(false);
                            return;
                        }
                        sb.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                    } while (!result.EndOfMessage);

                    _messages.Enqueue(sb.ToString());
                }
            }
            catch (OperationCanceledException) { }
            catch (Exception e)
            {
                Debug.LogWarning($"[Fangame] WebSocket error: {e.Message}");
            }
        }
    }
}
