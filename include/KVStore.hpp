#ifndef KVSTORE_HPP
#define KVSTORE_HPP

#include <string>
#include <vector>
#include <unordered_map>
#include <shared_mutex>
#include <fstream> // Required for binary file handling

class ShardedKVStore
{
private:
    struct Shard
    {
        std::unordered_map<std::string, std::string> map;
        mutable std::shared_mutex mtx; // Fine-grained bucket level lock
    };

    size_t num_shards;
    std::vector<Shard> shards;

    // Internal hash function to route keys to their specific shard safely
    size_t get_shard_index(const std::string &key) const;

public:
    explicit ShardedKVStore(size_t shards_count = 16);

    void set(const std::string &key, const std::string &value);
    std::string get(const std::string &key) const;
    bool del(const std::string &key);

    // --- MODULE 4: PERSISTENCE CORE METHODS ---
    bool saveToFile(const std::string &filepath);
    bool loadFromFile(const std::string &filepath);
};

#endif // KVSTORE_HPP