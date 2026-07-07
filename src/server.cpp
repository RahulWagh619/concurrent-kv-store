#include <iostream>
#include <string>
#include <sstream>
#include "../include/KVStore.hpp"

using namespace std;

// Connect directly to your global 16-shard database
ShardedKVStore db(500);

// Define the absolute path for our persistence file
const string DB_FILE = "vertex_data.db";

string clean_string(const string &str)
{
    string cleaned = str;
    while (!cleaned.empty() && (cleaned.back() == '\r' || cleaned.back() == '\n' || cleaned.back() == ' '))
    {
        cleaned.pop_back();
    }
    return cleaned;
}

int main()
{
    // --- MODULE 4: AUTO-RECOVERY ---
    // The moment the server boots, try to rebuild the database from the binary file
    if (db.loadFromFile(DB_FILE))
    {
        cerr << "[C++ Engine] Successfully loaded data from " << DB_FILE << endl;
    }
    else
    {
        cerr << "[C++ Engine] No existing database found. Starting fresh." << endl;
    }

    // Optimize standard I/O operations for high-throughput pipeline streaming
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string raw_input;
    // Continuously listen to incoming data pipes from Node.js
    while (getline(cin, raw_input))
    {
        raw_input = clean_string(raw_input);
        if (raw_input.empty())
            continue;

        stringstream ss(raw_input);
        string command, key, value;
        ss >> command;

        string response;

        // --- MODULE 4: EXPLICIT SNAPSHOT COMMAND ---
        if (command == "SAVE" || command == "save")
        {
            if (db.saveToFile(DB_FILE))
            {
                response = "SUCCESS: Database snapshot saved to disk.";
            }
            else
            {
                response = "ERROR: Failed to write database to disk.";
            }
        }
        else
        {
            // It's a standard KV command, requires a key
            ss >> key;
            getline(ss, value);
            if (!value.empty() && value[0] == ' ')
                value.erase(0, 1);
            value = clean_string(value);

            if (command == "SET" || command == "set")
            {
                if (key.empty() || value.empty())
                {
                    response = "ERROR: Missing parameters";
                }
                else
                {
                    db.set(key, value);
                    response = "OK";
                }
            }
            else if (command == "GET" || command == "get")
            {
                if (key.empty())
                {
                    response = "ERROR: Missing key";
                }
                else
                {
                    response = db.get(key);
                    if (response.empty())
                        response = "ERROR: Key not found";
                }
            }
            else if (command == "DEL" || command == "del")
            {
                if (key.empty())
                {
                    response = "ERROR: Missing key";
                }
                else
                {
                    response = db.del(key) ? "SUCCESS" : "ERROR: Key not found";
                }
            }
            else
            {
                response = "ERROR: Unknown command";
            }
        }

        // Print the result to the output pipe with a distinct newline delimiter
        cout << response << "\n"
             << flush;
    }

    return 0;
}