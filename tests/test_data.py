"""Integrity checks for the static JSON data. Run: python -m unittest discover tests"""
import json
import pathlib
import unittest

DATA = pathlib.Path(__file__).resolve().parent.parent / "docs" / "data"

METRIC_KEYS = {
    "warm_weather", "seasonal_variety", "nature_mountains", "nature_lakes_rivers", "nature_sea_beaches",
    "nature_forests_greenery", "cost_of_living", "housing_affordability", "tax_burden", "visa_difficulty",
    "pace_of_life", "social_tolerance", "safety", "healthcare_quality", "english_barrier",
    "walkability_transit", "internet_speed", "work_culture", "humidity_level", "air_quality",
    "sunshine_hours", "childcare_education_cost", "dining_food_cost", "bureaucracy_difficulty",
    "foreigner_friendliness", "road_quality", "local_job_market", "phd_stipend_ppp",
    "academic_satisfaction", "happiness_index", "ease_of_doing_business", "childcare_quality",
}


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class CountriesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load("countries.json")
        cls.countries = cls.doc["countries"]
        cls.templates = cls.doc["templates"]

    def assert_metrics(self, owner, metrics):
        self.assertEqual(set(metrics), METRIC_KEYS, owner)
        for key, value in metrics.items():
            self.assertTrue(0 <= value <= 10, f"{owner}.{key}={value}")

    def test_unique_ids(self):
        ids = [c["id"] for c in self.countries]
        self.assertEqual(len(ids), len(set(ids)))

    def test_curated_countries_are_complete(self):
        curated = [c for c in self.countries if c["quality"] == "curated"]
        self.assertEqual(len(curated), 20)
        for c in curated:
            for field in ("summary", "overview", "visaInfo", "pros", "cons"):
                self.assertTrue(c[field], f"{c['id']}.{field}")
            self.assert_metrics(c["id"], c["metrics"])

    def test_template_countries_carry_no_own_scores_or_text(self):
        for c in self.countries:
            if c["quality"] == "template":
                self.assertIn(c["template"], self.templates, c["id"])
                for field in ("metrics", "summary", "overview", "pros", "cons", "visaInfo"):
                    self.assertNotIn(field, c, f"template country {c['id']} must not override {field}")

    def test_templates_have_full_metrics(self):
        for key, t in self.templates.items():
            self.assert_metrics(key, t["metrics"])

    def test_no_placeholder_facts(self):
        for c in self.countries:
            facts = c["facts"]
            self.assertTrue(facts["capital"] and facts["currency"], c["id"])
            self.assertNotIn("National Language", facts["languages"], c["id"])
            self.assertTrue(c["cities"], c["id"])
            self.assertLessEqual(len(c["cities"]), 8, c["id"])

    def test_every_country_has_a_known_quality(self):
        for c in self.countries:
            self.assertIn(c["quality"], {"curated", "template"}, c["id"])


class UniversitiesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.universities = load("universities.json")["universities"]
        cls.country_ids = {c["id"] for c in load("countries.json")["countries"]}

    def test_only_universities_no_generated_entities(self):
        allowed = {"id", "name", "city", "country", "countryId", "arwuRank", "arwuBand"}
        for u in self.universities:
            self.assertEqual(set(u), allowed, u["id"])
            self.assertNotRegex(u["name"], r"State University|Research Group|Laboratory of|Institute for ", u["id"])

    def test_unique_ids(self):
        ids = [u["id"] for u in self.universities]
        self.assertEqual(len(ids), len(set(ids)))

    def test_country_links_resolve(self):
        for u in self.universities:
            if u["countryId"] is not None:
                self.assertIn(u["countryId"], self.country_ids, u["id"])

    def test_rank_band_matches_rank(self):
        for u in self.universities:
            if u["arwuRank"] <= 100:
                self.assertEqual(u["arwuBand"], f"#{u['arwuRank']}", u["id"])
            else:
                lo, hi = (int(x) for x in u["arwuBand"].split("–"))
                self.assertTrue(lo <= u["arwuRank"] <= hi, u["id"])


class WorldBankTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load("worldbank.json")
        cls.meta = cls.doc["meta"]
        cls.country_ids = {c["id"] for c in load("countries.json")["countries"]}

    def test_every_scored_metric_is_a_site_metric_and_documented(self):
        for key, m in self.meta["metrics"].items():
            self.assertIn(key, METRIC_KEYS)
            for field in ("indicators", "measure", "unit", "transform"):
                self.assertTrue(m[field], f"{key}.{field}")

    def test_values_are_recent_and_in_range(self):
        min_year = self.meta["minYear"]
        for cid, entry in self.doc["countries"].items():
            self.assertIn(cid, self.country_ids)
            for key, v in entry["metrics"].items():
                self.assertIn(key, self.meta["metrics"], f"{cid}.{key}")
                self.assertTrue(0 <= v["score"] <= 10, f"{cid}.{key}")
                self.assertGreaterEqual(v["year"], min_year, f"{cid}.{key}")
                self.assertIsInstance(v["raw"], (int, float))
            for key, f in entry["facts"].items():
                self.assertIn(key, self.meta["facts"])
                self.assertGreaterEqual(f["year"], min_year)

    def test_coverage_is_high(self):
        values = sum(len(e["metrics"]) for e in self.doc["countries"].values())
        possible = len(self.country_ids) * len(self.meta["metrics"])
        self.assertGreater(values / possible, 0.9)

    def test_source_is_attributed(self):
        self.assertEqual(self.meta["license"], "CC BY 4.0")
        self.assertTrue(self.meta["retrieved"])


if __name__ == "__main__":
    unittest.main()
