#include "../include/KVStore.hpp"
#include <functional>
#include <fstream>
#include <iostream>
#include <cstdint> // For strict 32-bit integer sizing
#include <mutex>

using namespace std;

// Constructor
ShardedKVStore::ShardedKVStore(size_t shards_count) : num_shards(shards_count), shards(shards_count) {}

// Internal routing function
size_t ShardedKVStore::get_shard_index(const string &key) const
{
    return hash<string>{}(key) % num_shards;
}

// Write operation (Requires unique lock)
void ShardedKVStore::set(const string &key, const string &value)
{
    size_t index = get_shard_index(key);
    unique_lock<shared_mutex> lock(shards[index].mtx);
    shards[index].map[key] = value;
}

// Read operation (Requires shared lock)
string ShardedKVStore::get(const string &key) const
{
    size_t index = get_shard_index(key);
    shared_lock<shared_mutex> lock(shards[index].mtx);
    auto it = shards[index].map.find(key);
    if (it != shards[index].map.end())
    {
        return it->second;
    }
    return "";
}

// Delete operation (Requires unique lock)
bool ShardedKVStore::del(const string &key)
{
    size_t index = get_shard_index(key);
    unique_lock<shared_mutex> lock(shards[index].mtx);
    return shards[index].map.erase(key) > 0;
}

// =========================================================
// MODULE 4: PERSISTENCE ENGINE (BINARY SERIALIZATION)
// =========================================================

bool ShardedKVStore::saveToFile(const string &filepath)
{
    // Open the file strictly in raw binary write mode
    ofstream out(filepath, ios::binary);
    if (!out)
    {
        cerr << "[DB Error] Cannot open file for writing: " << filepath << endl;
        return false;
    }

    // 1. Write the Magic Header (8 bytes)
    const char magic[] = "VERTEXDB";
    out.write(magic, 8);

    // 2. Calculate total items across all shards safely
    uint32_t total_items = 0;
    for (size_t i = 0; i < num_shards; ++i)
    {
        shared_lock<shared_mutex> lock(shards[i].mtx);
        total_items += shards[i].map.size();
    }

    // Write the Metadata (4-byte integer)
    out.write(reinterpret_cast<const char *>(&total_items), sizeof(total_items));

    // 3. Serialize the Data Blocks
    for (size_t i = 0; i < num_shards; ++i)
    {
        // We use a SHARED lock here! This means clients can still run GET operations
        // on this shard simultaneously while we are copying it to the disk.
        shared_lock<shared_mutex> lock(shards[i].mtx);

        for (const auto &pair : shards[i].map)
        {
            // Write Key
            uint32_t k_len = pair.first.size();
            out.write(reinterpret_cast<const char *>(&k_len), sizeof(k_len));
            out.write(pair.first.data(), k_len);

            // Write Value
            uint32_t v_len = pair.second.size();
            out.write(reinterpret_cast<const char *>(&v_len), sizeof(v_len));
            out.write(pair.second.data(), v_len);
        }
    }

    out.close();
    return true;
}

bool ShardedKVStore::loadFromFile(const string &filepath)
{
    // Open the file strictly in raw binary read mode
    ifstream in(filepath, ios::binary);
    if (!in)
    {
        // It is perfectly normal for this to fail on the very first boot
        // when the database file hasn't been created yet.
        return false;
    }

    // 1. Validate the Magic Header
    char magic[9] = {0}; // 8 bytes + null terminator
    in.read(magic, 8);
    if (string(magic) != "VERTEXDB")
    {
        cerr << "[DB Error] File is corrupted or not a Vertex Database." << endl;
        return false;
    }

    // 2. Read the Metadata count
    uint32_t total_items = 0;
    in.read(reinterpret_cast<char *>(&total_items), sizeof(total_items));

    // 3. Reconstruct the Data Blocks
    for (uint32_t i = 0; i < total_items; ++i)
    {
        // Read Key
        uint32_t k_len = 0;
        in.read(reinterpret_cast<char *>(&k_len), sizeof(k_len));
        string key(k_len, '\0');
        in.read(&key[0], k_len); // Copy raw bytes straight into string memory

        // Read Value
        uint32_t v_len = 0;
        in.read(reinterpret_cast<char *>(&v_len), sizeof(v_len));
        string value(v_len, '\0');
        in.read(&value[0], v_len);

        // Safely route the reconstructed data back into the memory shards
        set(key, value);
    }

    in.close();
    return true;
}