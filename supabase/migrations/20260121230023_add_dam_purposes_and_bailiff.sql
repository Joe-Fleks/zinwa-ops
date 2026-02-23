/*
  # Add Dam Purposes and Bailiff Fields

  1. Changes
    - Add `purposes` column to `dams` table (array of text)
      - Supports multiple purposes: Domestic Water Supply, Irrigation, Recreation & Tourism, 
        Power Generation, Industry, Aquaculture, Flood Control
      - Not mandatory, can be null
    - Add `bailiff` column to `dams` table (text)
      - Stores the name of the bailiff responsible for the dam
      - Not mandatory, can be null
  
  2. Notes
    - Uses text array type for flexible multi-purpose selection
    - No RLS changes needed as dams table already has proper policies
    - Fields are optional to allow gradual data entry
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dams' AND column_name = 'purposes'
  ) THEN
    ALTER TABLE dams ADD COLUMN purposes text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dams' AND column_name = 'bailiff'
  ) THEN
    ALTER TABLE dams ADD COLUMN bailiff text;
  END IF;
END $$;