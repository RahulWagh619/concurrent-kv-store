#include <iostream>
#include <string>
#include <windows.h>
#include <winhttp.h>

#pragma comment(lib, "winhttp.lib")

using namespace std;

// Helper function to send HTTP requests to our Node.js gateway
void send_http_request(const string &path, const string &method, const string &json_payload = "")
{
    HINTERNET hSession = WinHttpOpen(L"VertexClient/1.0", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    HINTERNET hConnect = WinHttpConnect(hSession, L"localhost", 3000, 0);

    wstring wpath(path.begin(), path.end());
    wstring wmethod(method.begin(), method.end());

    HINTERNET hRequest = WinHttpOpenRequest(hConnect, wmethod.c_str(), wpath.c_str(), NULL, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, 0);

    bool success = false;
    if (hRequest)
    {
        wstring headers = L"Content-Type: application/json\r\n";
        if (!json_payload.empty())
        {
            success = WinHttpSendRequest(hRequest, headers.c_str(), -1L, (LPVOID)json_payload.c_str(), json_payload.length(), json_payload.length(), 0);
        }
        else
        {
            success = WinHttpSendRequest(hRequest, headers.c_str(), -1L, WINHTTP_NO_REQUEST_DATA, 0, 0, 0);
        }
    }

    if (success && WinHttpReceiveResponse(hRequest, NULL))
    {
        DWORD dwSize = 0;
        WinHttpQueryDataAvailable(hRequest, &dwSize);
        if (dwSize > 0)
        {
            LPSTR pszOutBuffer = new char[dwSize + 1];
            DWORD dwDownloaded = 0;
            ZeroMemory(pszOutBuffer, dwSize + 1);

            if (WinHttpReadData(hRequest, (LPVOID)pszOutBuffer, dwSize, &dwDownloaded))
            {
                string response(pszOutBuffer);
                // Look for the inner text data returned from our C++ engine
                size_t data_pos = response.find("\"data\":\"");
                if (data_pos != string::npos)
                {
                    string clean_resp = response.substr(data_pos + 8);
                    clean_resp = clean_resp.substr(0, clean_resp.find("\""));
                    cout << clean_resp << endl;
                }
                else
                {
                    cout << response << endl;
                }
            }
            delete[] pszOutBuffer;
        }
    }
    else
    {
        cout << "ERROR: Failed to reach Vertex Engine. Is app.js running?" << endl;
    }

    if (hRequest)
        WinHttpCloseHandle(hRequest);
    if (hConnect)
        WinHttpCloseHandle(hConnect);
    if (hSession)
        WinHttpCloseHandle(hSession);
}

int main()
{
    cout << "--- Welcome to Vertex Distributed DB Client ---" << endl;
    cout << "Type commands: SET <key> <val> | GET <key> | DEL <key> | SAVE | EXIT\n"
         << endl;

    while (true)
    {
        cout << "Vertex> ";
        string raw_line;
        if (!getline(cin, raw_line))
            break;

        if (raw_line == "EXIT" || raw_line == "exit")
            break;
        if (raw_line.empty())
            continue;

        size_t first_space = raw_line.find(' ');
        string op = (first_space == string::npos) ? raw_line : raw_line.substr(0, first_space);

        if (op == "SET" || op == "set")
        {
            string remainder = raw_line.substr(first_space + 1);
            size_t second_space = remainder.find(' ');
            if (second_space == string::npos)
            {
                cout << "ERROR: Syntax is SET <key> <value>" << endl;
                continue;
            }
            string key = remainder.substr(0, second_space);
            string val = remainder.substr(second_space + 1);

            string json = "{\"key\":\"" + key + "\", \"value\":\"" + val + "\"}";
            send_http_request("/set", "POST", json);
        }
        else if (op == "GET" || op == "get")
        {
            if (first_space == string::npos)
            {
                cout << "ERROR: Syntax is GET <key>" << endl;
                continue;
            }
            string key = raw_line.substr(first_space + 1);
            send_http_request("/get/" + key, "GET");
        }
        else if (op == "DEL" || op == "del")
        {
            if (first_space == string::npos)
            {
                cout << "ERROR: Syntax is DEL <key>" << endl;
                continue;
            }
            string key = raw_line.substr(first_space + 1);
            send_http_request("/del/" + key, "DELETE");
        }
        else if (op == "SAVE" || op == "save")
        {
            send_http_request("/save", "POST");
        }
        else
        {
            cout << "ERROR: Unknown command '" << op << "'" << endl;
        }
    }
    return 0;
}